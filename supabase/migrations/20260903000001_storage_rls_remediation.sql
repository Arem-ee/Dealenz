-- DRAFT, NOT EXECUTED. Human review and explicit approval required before use.
-- See PHASE_4A_REMEDIATION_EXECUTION_PLAN.md. Do not apply without approval.
--
-- Purpose: carry forward the four storage.objects policies from
-- supabase/migrations/00014_storage_rls.sql, whose first statement
-- (ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY) cannot run on
-- hosted Supabase because the platform owns storage.objects (SQLSTATE 42501).
-- Live verification confirmed RLS already enabled on storage.objects, so this
-- file creates policies only and never alters RLS state on the platform table.
--
-- Policies below are verbatim from 00014_storage_rls.sql lines 3 through 45,
-- including the duplicate_object guards. No roles, operations, bucket
-- restrictions, ownership predicates, path predicates, USING expressions,
-- or WITH CHECK expressions were changed.

-- Guard: fail loudly if RLS is ever not enabled on storage.objects.
-- Catalog read only. Alters nothing. If this guard ever fires, the
-- platform assumption behind this remediation no longer holds.
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
