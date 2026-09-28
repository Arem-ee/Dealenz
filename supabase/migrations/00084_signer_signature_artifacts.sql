-- Drawn/typed signature images for the signing ceremony (tablet-style
-- "sign on the document"). One artifact per signer, replaced on re-draw.
-- Storage-only: ceremony validity still flows exclusively through the
-- token-gated sign_as_owner / sign_as_invitee RPCs. Writes go through
-- service-role routes (invitees are unauthenticated, so no RLS write policy
-- could scope them); reads are owner-scoped below.
-- STAGING: verify RLS + upsert behavior on staging before prod (db push).

CREATE TABLE IF NOT EXISTS signer_signature_artifacts (
  signer_id UUID PRIMARY KEY REFERENCES document_signers(id) ON DELETE CASCADE,
  image_data TEXT NOT NULL CHECK (char_length(image_data) BETWEEN 100 AND 70000),
  method TEXT NOT NULL CHECK (method IN ('drawn', 'typed', 'uploaded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signer_signature_artifacts_signer
  ON signer_signature_artifacts(signer_id);

ALTER TABLE signer_signature_artifacts ENABLE ROW LEVEL SECURITY;

-- Deal owner reads artifacts for their own audits (renders the signed
-- signature in the reader execution block). No user-write policies: all
-- writes are service-role after token/ownership verification in routes.
CREATE POLICY "Owners read signature artifacts on own audits"
  ON signer_signature_artifacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM document_signers s
      JOIN audits a ON a.id = s.audit_id
      WHERE s.id = signer_signature_artifacts.signer_id
        AND a.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.signer_signature_artifacts TO service_role;
