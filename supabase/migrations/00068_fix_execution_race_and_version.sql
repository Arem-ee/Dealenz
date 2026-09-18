-- Hostile audit remediation: #5 execution race, version_number race, #14 Gmail refresh (partial)
-- Prevent duplicate active executions for same plan_version and duplicate document version_numbers.

-- 1. Prevent duplicate active executions (pending/running) for same plan_version
-- This is the DB guard for src/lib/work/executor.ts:217 race
CREATE UNIQUE INDEX IF NOT EXISTS uq_work_executions_active
  ON work_executions (plan_id, plan_version)
  WHERE status IN ('pending','running','needs_input','rate_limited');

-- 2. Ensure document_versions version_number is unique per deal+type (if not already)
-- 00042 may have added, but ensure idempotency
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_document_version' AND conrelid = 'public.document_versions'::regclass) THEN
    -- Use index-based unique constraint via unique index
    CREATE UNIQUE INDEX IF NOT EXISTS uq_document_version
      ON document_versions (audit_id, document_type, version_number);
  END IF;
END $$;

-- 3. Add advisory lock helper for app-level plan locking (optional RPC)
CREATE OR REPLACE FUNCTION acquire_plan_lock(p_plan_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('plan:' || p_plan_id::text));
END;
$$;

GRANT EXECUTE ON FUNCTION acquire_plan_lock(UUID) TO authenticated;

-- 4. Add helper for redraft lock (used by app path if needed)
CREATE OR REPLACE FUNCTION acquire_redraft_lock(p_source_version_id UUID, p_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('redraft:' || p_source_version_id::text || ':' || p_key));
END;
$$;

GRANT EXECUTE ON FUNCTION acquire_redraft_lock(UUID, TEXT) TO authenticated;
