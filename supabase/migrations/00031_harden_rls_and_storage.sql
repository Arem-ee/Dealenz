-- Phase 19 hardening: document_versions UPDATE RLS + storage legacy cleanup.
-- Forward-only, does not edit historical migrations.

-- 1. document_versions: add missing UPDATE policy (was SELECT+INSERT only).
-- Uses same ownership model as other tables: auth.uid() = user_id.
DO $$
BEGIN
  CREATE POLICY "Users update own document versions"
    ON document_versions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Storage: drop legacy permissive policies from 00002 that lack bucket_id check.
-- 00014 already created bucket-scoped equivalents, so dropping 00002 is safe.
-- Keep OR semantics removed; owner can only access audit-files bucket.

DROP POLICY IF EXISTS "Users can view own audit files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own audit files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own audit files" ON storage.objects;
