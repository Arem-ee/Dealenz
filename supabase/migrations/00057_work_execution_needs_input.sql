-- Phase 1 correction: make needs_input a resumable state, not failed.
--
-- Audit finding: work_executions already permits needs_input, but work_plans
-- does not. Executor mapped needs_input → failed, losing audit of the
-- approved payload_hash / plan_version and forcing a new plan on retry.
-- This migration widens the work_plans status check to include needs_input
-- and allows approved_at to coexist with needs_input (approved plan now
-- executing and paused). No historical migration is edited.
--
-- Also adds durable idempotency guards:
--   * conversation_messages: partial unique index on (conversation_id, metadata->>'executionId')
--     prevents duplicate risk_report messages on rapid double-Approve.
--   * work_products: unique on (plan_id, execution_id) where execution_id is not null
--     prevents duplicate work products on retry (executor inserts once per execution).

-- 1. Widen work_plans.status to include needs_input
DO $$
BEGIN
  -- Drop the auto-named status check if it exists (Postgres names it work_plans_status_check)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_plans_status_check' AND conrelid = 'public.work_plans'::regclass) THEN
    ALTER TABLE public.work_plans DROP CONSTRAINT work_plans_status_check;
  END IF;
END $$;

ALTER TABLE public.work_plans
  ADD CONSTRAINT work_plans_status_check
  CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'executing', 'needs_input', 'done', 'failed', 'canceled'));

-- 2. Allow approved_at with needs_input (approved plan now paused, not failed)
ALTER TABLE public.work_plans DROP CONSTRAINT IF EXISTS work_plans_approved_requires_status;

ALTER TABLE public.work_plans
  ADD CONSTRAINT work_plans_approved_requires_status
  CHECK ((approved_at IS NULL) OR (status IN ('approved', 'executing', 'needs_input', 'done', 'failed')));

-- 3. Idempotency: one risk_report per execution per conversation
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_messages_execution_id
  ON public.conversation_messages (conversation_id, ((metadata->>'executionId')))
  WHERE metadata ? 'executionId' AND (metadata->>'executionId') IS NOT NULL AND char_length(metadata->>'executionId') > 0;

-- 4. Idempotency: one work_product per execution per plan
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_products_plan_execution
  ON public.work_products (plan_id, execution_id)
  WHERE execution_id IS NOT NULL;
