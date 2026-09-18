-- Phase 23C: bounded work execution core — Plan + PlanStep + Approval + ExecutionRun + WorkProduct.
--
-- Objective → Plan + Cost → Human Approval → Execute → Observe → Work Product → Audit Trail
--
-- Design constraints (audit-backed):
--   * No generic agent framework, no second AI router/store/credit/evidence system.
--   * Reuses existing primitives: AIOperation (src/lib/ai/operations.ts), credit_ledger
--     reserve/finalize/void (00023), conversations/audits, document_versions (00012/00048),
--     activity_events/system_logs, evidence schema, ContextEnvelope provenance.
--   * Bounded operations only; spreadsheet is transient work input, not CRM.
--   * Approval binds exact plan version + payload hash; stale approval cannot authorize new plan.
--   * Plan-level credit reservation uses existing ledger RPCs (one reservation for estimated sum).
--   * All tables: user_id scoped, RLS enabled, no service_role grants, no public writes.
--   * Forward-only, non-destructive, no historical migration edits.

-- 1. Work plans — the persistent plan container for a bounded objective.
CREATE TABLE work_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES audits(id) ON DELETE SET NULL,
  objective TEXT NOT NULL CHECK (char_length(objective) BETWEEN 1 AND 4000),
  objective_kind TEXT NOT NULL DEFAULT 'deal_analysis' CHECK (objective_kind IN ('deal_analysis', 'proposal_single', 'proposal_batch', 'protection', 'lawyer_review', 'custom')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  estimated_credits INTEGER NOT NULL CHECK (estimated_credits >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'executing', 'done', 'failed', 'canceled')),
  -- payload hash of version's canonical steps+objective+estimated_credits; approval must match this exact hash
  payload_hash TEXT NOT NULL CHECK (char_length(payload_hash) BETWEEN 10 AND 200),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT work_plans_approved_requires_status CHECK (
    (approved_at IS NULL) OR (status IN ('approved', 'executing', 'done', 'failed'))
  )
);

CREATE INDEX idx_work_plans_user_created ON work_plans(user_id, created_at DESC);
CREATE INDEX idx_work_plans_conversation ON work_plans(conversation_id);
CREATE INDEX idx_work_plans_deal ON work_plans(deal_id);
CREATE INDEX idx_work_plans_status ON work_plans(status);

ALTER TABLE work_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own work plans"
  ON work_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Plan steps — ordered, bounded, optionally DAG-shaped.
CREATE TABLE work_plan_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES work_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL CHECK (step_index >= 0),
  operation TEXT NOT NULL CHECK (char_length(operation) BETWEEN 1 AND 40),
  -- JSONB input reference: { dealId, conversationId, fileRef, variables, ... } depending on operation
  input_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  depends_on UUID[] NOT NULL DEFAULT '{}',
  estimated_credits INTEGER NOT NULL CHECK (estimated_credits >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'running', 'succeeded', 'failed', 'needs_input', 'blocked', 'skipped')),
  result_ref JSONB,
  credits_consumed INTEGER CHECK (credits_consumed IS NULL OR credits_consumed >= 0),
  error TEXT CHECK (error IS NULL OR char_length(error) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT work_plan_steps_unique_index UNIQUE (plan_id, step_index)
);

CREATE INDEX idx_work_plan_steps_plan ON work_plan_steps(plan_id, step_index);
CREATE INDEX idx_work_plan_steps_status ON work_plan_steps(status);

ALTER TABLE work_plan_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own plan steps"
  ON work_plan_steps FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Approvals — immutable artifact binding approval to exact plan version + payload hash.
CREATE TABLE work_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES work_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_version INTEGER NOT NULL CHECK (plan_version >= 1),
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_payload_hash TEXT NOT NULL CHECK (char_length(approved_payload_hash) BETWEEN 10 AND 200),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 120),
  CONSTRAINT work_approvals_user_idempotency UNIQUE (user_id, idempotency_key),
  CONSTRAINT work_approvals_actor_matches_user CHECK (actor_user_id = user_id)
);

CREATE INDEX idx_work_approvals_plan ON work_approvals(plan_id, plan_version);
CREATE INDEX idx_work_approvals_user ON work_approvals(user_id);

ALTER TABLE work_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own approvals"
  ON work_approvals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Execution runs — one run per approved plan execution attempt.
CREATE TABLE work_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES work_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_version INTEGER NOT NULL CHECK (plan_version >= 1),
  reservation_id UUID REFERENCES credit_ledger(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'canceled', 'needs_input', 'needs_approval')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT work_executions_started_requires_running CHECK (
    (started_at IS NULL) OR (status IN ('running', 'succeeded', 'failed', 'canceled', 'needs_input'))
  )
);

CREATE INDEX idx_work_executions_plan ON work_executions(plan_id, created_at DESC);
CREATE INDEX idx_work_executions_user ON work_executions(user_id);
CREATE INDEX idx_work_executions_status ON work_executions(status);

ALTER TABLE work_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own executions"
  ON work_executions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Work products — narrow boundary associating artifacts with a plan/run.
CREATE TABLE work_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES work_plans(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES work_executions(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 40),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready_to_send', 'sent', 'locked', 'failed', 'superseded')),
  -- artifactRefs: [{ type: "document_version", id }, { type: "risk_report", auditId }, ...]
  artifact_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- snapshot: { findings, assumptions, citations, missingVariables, estimatedCredits, approvedPayloadHash, ... }
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_products_plan ON work_products(plan_id);
CREATE INDEX idx_work_products_execution ON work_products(execution_id);
CREATE INDEX idx_work_products_user ON work_products(user_id);
CREATE INDEX idx_work_products_kind ON work_products(kind);

ALTER TABLE work_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own work products"
  ON work_products FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
