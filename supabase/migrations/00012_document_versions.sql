CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('proposal', 'sow', 'contract', 'checklist')),
  version_number INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  generation_method TEXT NOT NULL DEFAULT 'template'
    CHECK (generation_method IN ('ai', 'template')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own document versions"
  ON document_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own document versions"
  ON document_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_document_versions_audit_id ON document_versions(audit_id);
CREATE INDEX idx_document_versions_user_id ON document_versions(user_id);
