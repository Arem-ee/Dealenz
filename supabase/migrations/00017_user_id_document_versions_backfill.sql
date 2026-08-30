-- Backfill user_id on document_versions for rows that may have a NULL user_id
UPDATE document_versions dv
  SET user_id = a.user_id
  FROM audits a
  WHERE dv.audit_id = a.id
    AND dv.user_id IS NULL;

-- Safely enforce NOT NULL constraint (idempotent)
ALTER TABLE document_versions
  ALTER COLUMN user_id SET NOT NULL;

-- Ensure SELECT policy exists (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'document_versions'
      AND policyname = 'Users read own document versions'
  ) THEN
    CREATE POLICY "Users read own document versions"
      ON document_versions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;
