-- Phase 1 closure: distinct rate_limited state for daily allowance exhaustion.
--
-- Rate limiting is fail-closed and must not be misclassified as needs_input
-- (which implies missing context that a ContextConfirmCard can fix) nor as
-- ordinary failed (which forces a new plan and loses approved payload_hash).
-- A dedicated rate_limited state preserves the approved plan identity,
-- requires no new plan, shows a clear daily-limit message (not a context form),
-- performs no AI call after the limit, and performs no credit reservation
-- (document_analysis is 0-credit). Resume is time-based (next day), not input-based.

-- 1. Widen work_plans.status to include rate_limited
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_plans_status_check' AND conrelid = 'public.work_plans'::regclass) THEN
    ALTER TABLE public.work_plans DROP CONSTRAINT work_plans_status_check;
  END IF;
END $$;

ALTER TABLE public.work_plans
  ADD CONSTRAINT work_plans_status_check
  CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'executing', 'needs_input', 'rate_limited', 'done', 'failed', 'canceled'));

-- Allow approved_at to coexist with rate_limited (approved plan now rate-limited)
ALTER TABLE public.work_plans DROP CONSTRAINT IF EXISTS work_plans_approved_requires_status;

ALTER TABLE public.work_plans
  ADD CONSTRAINT work_plans_approved_requires_status
  CHECK ((approved_at IS NULL) OR (status IN ('approved', 'executing', 'needs_input', 'rate_limited', 'done', 'failed')));

-- 2. Widen work_executions.status (already has needs_input, needs_approval; add rate_limited)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_executions_status_check' AND conrelid = 'public.work_executions'::regclass) THEN
    ALTER TABLE public.work_executions DROP CONSTRAINT work_executions_status_check;
  END IF;
END $$;

ALTER TABLE public.work_executions
  ADD CONSTRAINT work_executions_status_check
  CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'canceled', 'needs_input', 'needs_approval', 'rate_limited'));

-- Allow started_at with rate_limited (like needs_input)
ALTER TABLE public.work_executions DROP CONSTRAINT IF EXISTS work_executions_started_requires_running;

ALTER TABLE public.work_executions
  ADD CONSTRAINT work_executions_started_requires_running
  CHECK ((started_at IS NULL) OR (status IN ('running', 'succeeded', 'failed', 'canceled', 'needs_input', 'rate_limited')));

-- 3. Widen work_plan_steps.status to include rate_limited
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_plan_steps_status_check' AND conrelid = 'public.work_plan_steps'::regclass) THEN
    ALTER TABLE public.work_plan_steps DROP CONSTRAINT work_plan_steps_status_check;
  END IF;
END $$;

ALTER TABLE public.work_plan_steps
  ADD CONSTRAINT work_plan_steps_status_check
  CHECK (status IN ('pending', 'ready', 'running', 'succeeded', 'failed', 'needs_input', 'rate_limited', 'blocked', 'skipped'));
