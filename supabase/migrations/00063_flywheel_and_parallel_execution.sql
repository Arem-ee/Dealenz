-- Phase 3: data flywheel foundations + background/parallel bounded execution

-- 1. Proprietary data flywheel (structured, consented, tenant-isolated, deletable)
CREATE TABLE IF NOT EXISTS deal_intelligence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('deal_context','finding','protection_intent','user_decision','lawyer_review_outcome','document_version_change','interaction_pattern','deal_outcome')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance TEXT NOT NULL DEFAULT 'system' CHECK (provenance IN ('system','user','lawyer')),
  -- consent boundary: only if user has consented to flywheel (opt-in)
  consented BOOLEAN NOT NULL DEFAULT false,
  tenant_isolation TEXT NOT NULL DEFAULT 'user' CHECK (tenant_isolation IN ('user','anonymized','aggregated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT deal_intelligence_events_payload_limit CHECK (octet_length(payload::text) <= 10000)
);

CREATE INDEX IF NOT EXISTS idx_flywheel_audit ON deal_intelligence_events(audit_id);
CREATE INDEX IF NOT EXISTS idx_flywheel_user ON deal_intelligence_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flywheel_type ON deal_intelligence_events(event_type);
CREATE INDEX IF NOT EXISTS idx_flywheel_consented ON deal_intelligence_events(consented) WHERE consented = true;

ALTER TABLE deal_intelligence_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own flywheel events" ON deal_intelligence_events;
CREATE POLICY "Users manage own flywheel events"
  ON deal_intelligence_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Deletion: cascade on audit/user delete satisfies GDPR deletion requirement
-- No cross-user access, no selling.

-- 2. Expand work execution for background/parallel bounded execution
-- Add columns to work_executions for background tracking
ALTER TABLE work_executions
  ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_mode TEXT NOT NULL DEFAULT 'foreground' CHECK (execution_mode IN ('foreground','background','parallel')),
  ADD COLUMN IF NOT EXISTS concurrency INTEGER NOT NULL DEFAULT 1 CHECK (concurrency BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS parent_execution_id UUID REFERENCES work_executions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_executions_retry ON work_executions(next_retry_at) WHERE status IN ('failed','rate_limited','needs_input');
CREATE INDEX IF NOT EXISTS idx_work_executions_parent ON work_executions(parent_execution_id);

-- Expand work_plan_steps to support parallel DAG and idempotency keys per step
ALTER TABLE work_plan_steps
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT CHECK (idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 10 AND 200),
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_plan_steps_idempotency ON work_plan_steps(plan_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_plan_steps_next_retry ON work_plan_steps(last_attempt_at);

-- 3. Observability: system_logs.phase stays an open vocabulary. A closed CHECK
-- list was attempted here and removed: the application writes 30+ distinct
-- operational phases (auth_session_refresh, extraction, risk, rules,
-- file_metadata_*, share_token_*, ai_fallback/ai_failure, billing_webhook,
-- consultation_*, protection_package*, ...), so any closed list both rejects
-- real production rows on ADD CONSTRAINT and would start failing live
-- logging writes afterwards. No phase CHECK is created, and any legacy one
-- is dropped defensively.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_logs_phase_check' AND conrelid = 'public.system_logs'::regclass) THEN
    ALTER TABLE public.system_logs DROP CONSTRAINT system_logs_phase_check;
  END IF;
END $$;

-- 4. Home/Library attention items view helper (materialized via index, not new table)
-- Ensure work_plans and monitoring_events are indexed for Home queries
CREATE INDEX IF NOT EXISTS idx_work_plans_user_status_created ON work_plans(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_user_pending ON monitoring_alerts(user_id, status) WHERE status = 'pending';

-- Grants for service_role background worker
GRANT SELECT, INSERT, UPDATE ON deal_intelligence_events TO service_role;
GRANT SELECT, UPDATE ON work_executions TO service_role;
GRANT SELECT, UPDATE ON work_plan_steps TO service_role;
