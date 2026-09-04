-- Phase 5F closure fix: knowledge admin policies must not query auth.users.
--
-- Migration 00022 gated admin visibility behind EXISTS (SELECT ... FROM
-- auth.users ...). Neither anon nor authenticated roles hold SELECT on
-- auth.users, so the subquery raises permission-denied and fails the entire
-- SELECT instead of evaluating to false. The fix reads the same is_admin
-- flag from the session JWT via auth.jwt(), which needs no table privilege
-- and matches how the application sets the flag (user_metadata).
-- Authenticated non-admin reads are unaffected in outcome (published-only);
-- anonymous reads now evaluate instead of erroring.

DROP POLICY IF EXISTS "Admins can read all knowledge" ON knowledge_items;
CREATE POLICY "Admins can read all knowledge"
  ON knowledge_items FOR SELECT
  USING (
    status = 'published'
    OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admins can insert knowledge" ON knowledge_items;
CREATE POLICY "Admins can insert knowledge"
  ON knowledge_items FOR INSERT
  WITH CHECK (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admins can update knowledge" ON knowledge_items;
CREATE POLICY "Admins can update knowledge"
  ON knowledge_items FOR UPDATE
  USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) = true
  )
  WITH CHECK (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) = true
  );
