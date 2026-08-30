CREATE TABLE share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('proposal', 'sow', 'contract', 'checklist')),
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_share_tokens_token ON share_tokens(token);
CREATE INDEX idx_share_tokens_audit_id ON share_tokens(audit_id);

CREATE TABLE document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token_id UUID NOT NULL REFERENCES share_tokens(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('proposal', 'sow', 'contract', 'checklist')),
  signed_by_name TEXT NOT NULL,
  signed_by_email TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT
);

CREATE INDEX idx_document_signatures_share_token_id ON document_signatures(share_token_id);
CREATE INDEX idx_document_signatures_audit_id ON document_signatures(audit_id);

ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own share tokens"
  ON share_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM audits WHERE audits.id = share_tokens.audit_id AND audits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users read signatures on own audits"
  ON document_signatures FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM audits WHERE audits.id = document_signatures.audit_id AND audits.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION get_shared_document(p_token TEXT)
RETURNS TABLE (
  content TEXT,
  audit_id UUID,
  document_type TEXT,
  business_name TEXT,
  signed BOOLEAN,
  signed_by_name TEXT,
  signed_by_email TEXT,
  signed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share_id UUID;
  v_audit_id UUID;
  v_doc_type TEXT;
  v_user_id UUID;
BEGIN
  SELECT id, audit_id, document_type INTO v_share_id, v_audit_id, v_doc_type
  FROM share_tokens
  WHERE token = p_token
    AND revoked_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    dv.content,
    dv.audit_id,
    dv.document_type,
    COALESCE(bp.business_name, ''),
    ds.id IS NOT NULL,
    COALESCE(ds.signed_by_name, '')::TEXT,
    COALESCE(ds.signed_by_email, '')::TEXT,
    ds.signed_at
  FROM document_versions dv
  LEFT JOIN audits a ON a.id = dv.audit_id
  LEFT JOIN business_profiles bp ON bp.user_id = a.user_id
  LEFT JOIN LATERAL (
    SELECT id, signed_by_name, signed_by_email, signed_at
    FROM document_signatures
    WHERE share_token_id = v_share_id
    ORDER BY signed_at DESC
    LIMIT 1
  ) ds ON true
  WHERE dv.audit_id = v_audit_id
    AND dv.document_type = v_doc_type
  ORDER BY dv.version_number DESC
  LIMIT 1;

  INSERT INTO activity_events (user_id, audit_id, event_type, payload)
  VALUES (
    (SELECT user_id FROM audits WHERE id = v_audit_id),
    v_audit_id,
    'document_viewed',
    jsonb_build_object('document_type', v_doc_type, 'share_token_id', v_share_id)
  );

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION sign_shared_document(
  p_token TEXT,
  p_name TEXT,
  p_email TEXT,
  p_ip TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share_id UUID;
  v_audit_id UUID;
  v_doc_type TEXT;
BEGIN
  SELECT id, audit_id, document_type INTO v_share_id, v_audit_id, v_doc_type
  FROM share_tokens
  WHERE token = p_token
    AND revoked_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid or expired share link';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM document_signatures
    WHERE share_token_id = v_share_id
  ) THEN
    RETURN QUERY SELECT false, 'Document has already been signed';
    RETURN;
  END IF;

  INSERT INTO document_signatures (share_token_id, audit_id, document_type, signed_by_name, signed_by_email, ip_address)
  VALUES (v_share_id, v_audit_id, v_doc_type, p_name, p_email, p_ip);

  UPDATE share_tokens
  SET revoked_at = now()
  WHERE id = v_share_id;

  INSERT INTO activity_events (user_id, audit_id, event_type, payload)
  VALUES (
    (SELECT user_id FROM audits WHERE id = v_audit_id),
    v_audit_id,
    'document_signed',
    jsonb_build_object(
      'document_type', v_doc_type,
      'share_token_id', v_share_id,
      'signed_by_name', p_name,
      'signed_by_email', p_email
    )
  );

  RETURN QUERY SELECT true, 'Document signed successfully';
END;
$$;

GRANT EXECUTE ON FUNCTION get_shared_document TO anon;
GRANT EXECUTE ON FUNCTION sign_shared_document TO anon;
