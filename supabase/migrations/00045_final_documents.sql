-- Phase 8 document completion: explicit final-version pointers.
--
-- "Final" is never inferred from newest-version: one row per
-- (audit_id, document_type) names the version intended for execution,
-- preserving the link to full version history. Executed state stays
-- derived (final version + all bound signers signed); no executed flag
-- exists to be forged. Re-pointing is allowed only while unexecuted
-- (enforced server-side); new versions after execution never disturb the
-- pointer. No live application claimed.

CREATE TABLE IF NOT EXISTS final_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (char_length(document_type) BETWEEN 1 AND 120),
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_final_document UNIQUE (audit_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_final_documents_audit ON final_documents(audit_id);
CREATE INDEX IF NOT EXISTS idx_final_documents_version ON final_documents(document_version_id);

ALTER TABLE final_documents ENABLE ROW LEVEL SECURITY;

-- Deal owner reads and manages final pointers. No DELETE: completion
-- history is append-only (re-pointing updates the row; executed finals are
-- locked server-side, never deleted).
CREATE POLICY "Owners read own final documents"
  ON final_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM audits a
      WHERE a.id = final_documents.audit_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners insert own final documents"
  ON final_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM audits a
      WHERE a.id = final_documents.audit_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners update own final documents"
  ON final_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM audits a
      WHERE a.id = final_documents.audit_id AND a.user_id = auth.uid()
    )
  );
