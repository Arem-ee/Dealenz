-- Account-deletion repair, part 2: files cannot be removed in SQL.
--
-- Calling delete_own_account() (00075) as a real user proved the platform
-- rejects row deletes on storage.objects outright:
--   "Direct deletion from storage tables is not allowed. Use the Storage API
--   instead."
-- So file removal belongs in the app layer via the Storage API (the Settings
-- delete flow removes the caller's files first, while authenticated as them),
-- and this RPC handles the user row plus the cascade graph only. Each layer
-- surfaces its own real error instead of GoTrue's opaque
-- "Database error deleting user".
--
-- Forward-only. Safe re-run (OR REPLACE).
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('delete-account:' || v_user_id::text));

  -- NOTE: caller-owned storage objects must already be removed via the
  -- Storage API. Direct SQL deletes on storage.objects are rejected by the
  -- platform ("Direct deletion from storage tables is not allowed").
  DELETE FROM auth.users WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;
