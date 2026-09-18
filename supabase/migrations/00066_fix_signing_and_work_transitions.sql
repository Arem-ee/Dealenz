-- Hostile audit remediation: #3 signer forgery, #4 state transitions, #8 illegal direct lock
-- 1. Remove permissive direct signer UPDATE (critical #3)
DROP POLICY IF EXISTS "Owners update own document signers" ON document_signers;

-- Signing state must change only via RPCs (sign_as_owner, sign_as_invitee, sign_document_as_owner/counterparty, revoke_signer_invite)
-- No direct UPDATE policy remains for document_signers; only SELECT/INSERT via 00044 remain.

-- 2. Enforce work_plans state transitions at DB (fixes #4)
-- Canonical allowed transitions from src/lib/work/transitions.ts:14-17
CREATE OR REPLACE FUNCTION enforce_work_plan_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF OLD.status = 'draft' AND NEW.status IN ('awaiting_approval','canceled') THEN RETURN NEW; END IF;
  IF OLD.status = 'awaiting_approval' AND NEW.status IN ('approved','canceled','draft') THEN RETURN NEW; END IF;
  IF OLD.status = 'approved' AND NEW.status IN ('executing','canceled') THEN RETURN NEW; END IF;
  IF OLD.status = 'executing' AND NEW.status IN ('done','failed','canceled','needs_input','rate_limited') THEN RETURN NEW; END IF;
  IF OLD.status = 'needs_input' AND NEW.status IN ('executing','failed','canceled','draft') THEN RETURN NEW; END IF;
  IF OLD.status = 'rate_limited' AND NEW.status IN ('executing','failed','canceled','draft') THEN RETURN NEW; END IF;
  IF OLD.status = 'done' AND false THEN RETURN NEW; END IF;
  IF OLD.status = 'failed' AND NEW.status IN ('draft','canceled') THEN RETURN NEW; END IF;
  IF OLD.status = 'canceled' AND false THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Illegal work_plans transition % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_plans_transition ON work_plans;
CREATE TRIGGER trg_work_plans_transition
  BEFORE UPDATE OF status ON work_plans
  FOR EACH ROW EXECUTE FUNCTION enforce_work_plan_transition();

-- 3. Enforce work_executions transitions
CREATE OR REPLACE FUNCTION enforce_work_execution_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF OLD.status = 'pending' AND NEW.status IN ('running','canceled','needs_approval') THEN RETURN NEW; END IF;
  IF OLD.status = 'running' AND NEW.status IN ('succeeded','failed','canceled','needs_input','needs_approval','rate_limited') THEN RETURN NEW; END IF;
  IF OLD.status = 'needs_input' AND NEW.status IN ('running','failed','canceled') THEN RETURN NEW; END IF;
  IF OLD.status = 'needs_approval' AND NEW.status IN ('running','failed','canceled') THEN RETURN NEW; END IF;
  IF OLD.status = 'rate_limited' AND NEW.status IN ('running','failed','canceled') THEN RETURN NEW; END IF;
  IF OLD.status IN ('succeeded','failed','canceled') AND false THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Illegal work_executions transition % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_executions_transition ON work_executions;
CREATE TRIGGER trg_work_executions_transition
  BEFORE UPDATE OF status ON work_executions
  FOR EACH ROW EXECUTE FUNCTION enforce_work_execution_transition();

-- 4. Enforce work_plan_steps transitions
CREATE OR REPLACE FUNCTION enforce_work_plan_step_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF OLD.status = 'pending' AND NEW.status IN ('ready','blocked','skipped') THEN RETURN NEW; END IF;
  IF OLD.status = 'ready' AND NEW.status IN ('running','blocked','skipped') THEN RETURN NEW; END IF;
  IF OLD.status = 'running' AND NEW.status IN ('succeeded','failed','needs_input','rate_limited','blocked') THEN RETURN NEW; END IF;
  IF OLD.status = 'succeeded' AND false THEN RETURN NEW; END IF;
  IF OLD.status = 'failed' AND NEW.status IN ('pending','skipped') THEN RETURN NEW; END IF;
  IF OLD.status = 'needs_input' AND NEW.status IN ('pending','skipped','failed') THEN RETURN NEW; END IF;
  IF OLD.status = 'rate_limited' AND NEW.status IN ('pending','skipped','failed') THEN RETURN NEW; END IF;
  IF OLD.status = 'blocked' AND NEW.status IN ('pending','ready','skipped') THEN RETURN NEW; END IF;
  IF OLD.status = 'skipped' AND false THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Illegal work_plan_steps transition % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_plan_steps_transition ON work_plan_steps;
CREATE TRIGGER trg_work_plan_steps_transition
  BEFORE UPDATE OF status ON work_plan_steps
  FOR EACH ROW EXECUTE FUNCTION enforce_work_plan_step_transition();

-- 5. Enforce document_versions signing lifecycle (fixes #4, #8)
-- Allowed: draft->ready_to_sign/ready_to_send, ready_to_sign/ready_to_send->owner_signed, owner_signed->counterparty_pending/sent/fully_signed, counterparty_pending/sent->fully_signed/locked, fully_signed->locked, locked->superseded
CREATE OR REPLACE FUNCTION enforce_document_version_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  -- also handle content/provenance immutability for locked already via enforce_document_version_lock; this is transition check
  IF OLD.status = 'draft' AND NEW.status IN ('ready_to_sign','ready_to_send') THEN RETURN NEW; END IF;
  IF OLD.status IN ('ready_to_sign','ready_to_send') AND NEW.status = 'owner_signed' THEN RETURN NEW; END IF;
  IF OLD.status = 'owner_signed' AND NEW.status IN ('counterparty_pending','sent','fully_signed') THEN RETURN NEW; END IF;
  IF OLD.status IN ('counterparty_pending','sent') AND NEW.status IN ('fully_signed','locked') THEN RETURN NEW; END IF;
  IF OLD.status = 'fully_signed' AND NEW.status = 'locked' THEN RETURN NEW; END IF;
  IF OLD.status = 'locked' AND NEW.status = 'superseded' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Illegal document_versions transition % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_version_transition ON document_versions;
CREATE TRIGGER trg_document_version_transition
  BEFORE UPDATE OF status ON document_versions
  FOR EACH ROW EXECUTE FUNCTION enforce_document_version_transition();

-- Ensure updated_at is not used to bypass transition: transitions above already cover status changes.
-- Keep existing enforce_document_version_lock trigger for content_hash/parent immutability and locked mutation
-- (created in 00060) — it remains active alongside this new transition trigger.
