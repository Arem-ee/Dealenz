-- Add reviewed column to document_versions for tracking document review state
ALTER TABLE document_versions
  ADD COLUMN reviewed BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_document_versions_reviewed ON document_versions(reviewed);

-- Add UPDATE policy for document_versions (currently only SELECT and INSERT exist)
CREATE POLICY "Users update own document versions"
  ON document_versions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
