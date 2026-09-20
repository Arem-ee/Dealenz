-- Self-service account deletion: remove everything a user owns, then the user.
--
-- Background: Supabase Auth's admin user-delete fails opaquely
-- ("Database error deleting user") for accounts with deal history, and no
-- code path exists for a user to delete their own account at all — a GDPR
-- data-deletion gap, not just an ops annoyance. This RPC is the single choke
-- point for account erasure: it deletes the caller's storage objects (which
-- live outside the app FK graph), then deletes the auth user itself, letting
-- the verified ON DELETE CASCADE graph (audits via 00074 plus every other
-- user table) remove the rest. Any failure raises with the real constraint
-- detail instead of a generic message.
--
-- Safety properties:
-- - Acts ONLY on auth.uid(): a caller can erase no one but themselves.
-- - No parameters at all: nothing to tamper with.
-- - SECURITY DEFINER owned by postgres so it can reach storage.objects and
--   auth.users regardless of RLS; EXECUTE granted to authenticated only.
-- - Idempotent-ish: deleting twice fails the second time at auth.users
--   lookup (user already gone), which callers treat as success.
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

  -- Files first: storage lives outside the app FK graph.
  DELETE FROM storage.objects WHERE owner = v_user_id;

  -- The user row last: every app table cascades or nulls (verified
  -- 00001–00074), and auth-internal rows cascade within the auth schema.
  DELETE FROM auth.users WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;
