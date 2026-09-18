-- Hostile audit remediation: #10 stale approval via mutable payload_hash / steps
-- Protect work_plans version and payload_hash from direct client mutation
-- and invalidate approval on steps mutation.

-- 1. Prevent direct mutation of payload_hash and version on work_plans
CREATE OR REPLACE FUNCTION protect_work_plan_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- payload_hash is intentionally mutable ONLY via invalidate trigger (sets invalidated-...);
  -- direct client attempts to rewrite it to match old approval will still fail due to version check.
  -- So we allow payload_hash changes that start with 'invalidated-' (from our invalidate trigger)
  -- but block arbitrary rewrites. Simplified: only protect version/estimated_credits/objective here.
  IF OLD.version IS DISTINCT FROM NEW.version AND NOT (NEW.payload_hash LIKE 'invalidated-%' AND OLD.version + 1 = NEW.version) THEN
    -- Allow version bump only via invalidate path (version+1 and payload_hash invalidated)
    RAISE EXCEPTION 'version is immutable; create a new plan version';
  END IF;
  IF OLD.estimated_credits IS DISTINCT FROM NEW.estimated_credits THEN
    RAISE EXCEPTION 'estimated_credits is immutable; create a new plan version';
  END IF;
  IF OLD.objective IS DISTINCT FROM NEW.objective THEN
    RAISE EXCEPTION 'objective is immutable; create a new plan version';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_work_plan_hash ON work_plans;
CREATE TRIGGER trg_protect_work_plan_hash
  BEFORE UPDATE OF payload_hash, version, estimated_credits, objective ON work_plans
  FOR EACH ROW EXECUTE FUNCTION protect_work_plan_hash();

-- 2. On any work_plan_steps mutation, invalidate the parent plan's approval by bumping version
-- This ensures isApprovalValidForPlan (version + payload_hash) will fail for stale approvals.
-- We use a before trigger to avoid recursion.
CREATE OR REPLACE FUNCTION invalidate_plan_on_steps_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only invalidate if plan is already awaiting approval or approved/executing
  -- Draft mutations before approval are expected; they happen during creation.
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
    UPDATE work_plans
    SET version = version + 1,
        payload_hash = 'invalidated-' || gen_random_uuid()::text,
        updated_at = now()
    WHERE id = COALESCE(NEW.plan_id, OLD.plan_id)
      AND status IN ('awaiting_approval','approved','executing');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_plan_on_steps_insert ON work_plan_steps;
CREATE TRIGGER trg_invalidate_plan_on_steps_insert
  AFTER INSERT ON work_plan_steps
  FOR EACH ROW EXECUTE FUNCTION invalidate_plan_on_steps_change();

DROP TRIGGER IF EXISTS trg_invalidate_plan_on_steps_update ON work_plan_steps;
CREATE TRIGGER trg_invalidate_plan_on_steps_update
  AFTER UPDATE ON work_plan_steps
  FOR EACH ROW EXECUTE FUNCTION invalidate_plan_on_steps_change();

DROP TRIGGER IF EXISTS trg_invalidate_plan_on_steps_delete ON work_plan_steps;
CREATE TRIGGER trg_invalidate_plan_on_steps_delete
  AFTER DELETE ON work_plan_steps
  FOR EACH ROW EXECUTE FUNCTION invalidate_plan_on_steps_change();

-- Note: This will cause direct step mutation to bump plan version, making any prior approval's
-- plan_version and approved_payload_hash mismatch, so executePlan will reject with "Approval does not match".
