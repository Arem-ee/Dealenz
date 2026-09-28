-- Tamper-evident seal for executed versions (ceremony evidence package).
-- seal_hash is SHA-256 over the exact version content, written once at
-- first seal (first-writer-wins: later content drift reads as TAMPERED, never
-- silently resealed). sealed_at is the evidentiary timestamp. No RLS change:
-- versions are already owner-scoped for SELECT, and only service-role code
-- writes these columns after ceremony completion.
-- STAGING: verify on staging before prod (db push).

ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS seal_hash TEXT CHECK (seal_hash IS NULL OR seal_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN IF NOT EXISTS sealed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_document_versions_sealed
  ON document_versions(audit_id, sealed_at)
  WHERE sealed_at IS NOT NULL;
