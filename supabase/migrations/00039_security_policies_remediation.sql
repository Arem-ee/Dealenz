-- Phase 1 security hardening: forward-only RLS/authorization remediation.
--
-- Implements the corrections proposed in 20260903000001/02 (left untouched
-- for human review) in idempotent form, plus the app_metadata admin cutover:
--
-- 1. storage.objects audit-files policies created idempotently (00014 may
--    not have applied on hosted Supabase where the platform owns
--    storage.objects; 00031 dropped the legacy 00002 equivalents, so these
--    bucket-scoped policies are the live enforcement set). Guard fails
--    loudly if RLS is ever disabled on storage.objects.
-- 2. Lawyer assigned-request policies fixed: 00020 compared auth.uid() to
--    lawyer_id (a row UUID, never a user UUID), denying every lawyer.
--    Corrected to match through lawyers.user_id. DROP+CREATE (not ALTER)
--    so this is safe regardless of partial prior state.
-- 3. Admin authorization cutover from user_metadata to app_metadata.
--    user_metadata is writable by the account owner via auth.updateUser(),
--    so it must never confer privilege. app_metadata is writable only with
--    the service role. Policies read it from the session JWT (no auth.users
--    SELECT, which callers cannot perform). This also repairs the 00022
--    admin policies, which currently raise permission-denied instead of
--    evaluating, and supersedes 00025 (same policies, secure flag source).
--    Operational note: admin flags previously set in user_metadata must be
--    re-applied to app_metadata via the service role / dashboard; until
--    then admin access is denied (fail-closed).
-- 4. grant_credits admin check cutover to app_metadata (same reasoning).
--
-- No historical migration is edited. No live application is claimed here;
-- verify with `supabase db push` against a real project.

-- 1. Storage guard: RLS must be enabled on storage.objects.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'storage.objects RLS is not enabled; refusing to create audit-files policies';
  END IF;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can upload own files to audit-files"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'audit-files'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can view own files in audit-files"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'audit-files'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own files in audit-files"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'audit-files'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete own files in audit-files"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'audit-files'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Lawyer assigned-request policies: match through lawyers.user_id.
DROP POLICY IF EXISTS "Lawyers can view assigned consultation requests" ON consultation_requests;
CREATE POLICY "Lawyers can view assigned consultation requests"
  ON consultation_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lawyers
      WHERE lawyers.id = consultation_requests.lawyer_id
        AND lawyers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Lawyers can update assigned consultation requests" ON consultation_requests;
CREATE POLICY "Lawyers can update assigned consultation requests"
  ON consultation_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lawyers
      WHERE lawyers.id = consultation_requests.lawyer_id
        AND lawyers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lawyers
      WHERE lawyers.id = consultation_requests.lawyer_id
        AND lawyers.user_id = auth.uid()
    )
  );

-- 3a. Lawyers admin policies: app_metadata via session JWT.
DROP POLICY IF EXISTS "Admins can view all lawyers" ON lawyers;
CREATE POLICY "Admins can view all lawyers"
  ON lawyers FOR SELECT
  USING (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admins can update lawyer verification" ON lawyers;
CREATE POLICY "Admins can update lawyer verification"
  ON lawyers FOR UPDATE
  USING (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

-- 3b. Consultation request admin policies: app_metadata via session JWT.
DROP POLICY IF EXISTS "Admins can view all consultation requests" ON consultation_requests;
CREATE POLICY "Admins can view all consultation requests"
  ON consultation_requests FOR SELECT
  USING (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admins can update any consultation request" ON consultation_requests;
CREATE POLICY "Admins can update any consultation request"
  ON consultation_requests FOR UPDATE
  USING (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  )
  WITH CHECK (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

-- 3c. Knowledge admin policies: app_metadata via session JWT (supersedes 00025).
DROP POLICY IF EXISTS "Admins can read all knowledge" ON knowledge_items;
CREATE POLICY "Admins can read all knowledge"
  ON knowledge_items FOR SELECT
  USING (
    status = 'published'
    OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admins can insert knowledge" ON knowledge_items;
CREATE POLICY "Admins can insert knowledge"
  ON knowledge_items FOR INSERT
  WITH CHECK (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS "Admins can update knowledge" ON knowledge_items;
CREATE POLICY "Admins can update knowledge"
  ON knowledge_items FOR UPDATE
  USING (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  )
  WITH CHECK (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true
  );

-- 4. grant_credits: admin check via app_metadata (no auth.users SELECT needed).
CREATE OR REPLACE FUNCTION grant_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT
)
RETURNS TABLE(balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER := 0;
BEGIN
  IF NOT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Grant amount must be positive';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:' || p_user_id::text));

  INSERT INTO credit_ledger (user_id, entry_type, amount, operation, status, metadata)
  VALUES (p_user_id, 'grant', p_amount, NULL, 'finalized', jsonb_build_object('reason', p_reason));

  SELECT COALESCE(SUM(
    CASE
      WHEN t.status = 'voided' THEN 0
      WHEN t.entry_type IN ('grant', 'refund') THEN t.amount
      WHEN t.entry_type = 'adjustment' THEN t.amount
      WHEN t.entry_type = 'consumption' THEN -t.amount
      WHEN t.entry_type = 'reservation' AND t.status = 'pending' THEN -t.amount
      ELSE 0
    END
  ), 0) INTO v_balance
  FROM credit_ledger t
  WHERE t.user_id = p_user_id;
  RETURN QUERY SELECT v_balance;
END;
$$;
