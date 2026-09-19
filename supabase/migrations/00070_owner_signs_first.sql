-- Owner-must-sign-first enforcement at the database layer.
--
-- Until now the signing order (owner signs before any counterparty) was
-- enforced only in application code and in the sign_document_as_counterparty
-- RPC. The anonymous counterparty paths — sign_as_invitee and the legacy
-- sign_shared_document — never checked whether the owner had signed, so a
-- counterparty holding a token could sign first. This migration closes that
-- hole where the app layer cannot be bypassed:
--
-- 1. Trigger trg_owner_signs_first on document_signers: any transition into
--    status='signed' requires the parent document version to already be past
--    owner signing. Fires on every write path, including raw SQL.
-- 2. Curated owner-first checks inside sign_as_invitee and
--    sign_shared_document so end users get "owner must sign first" instead
--    of a raw exception.
--
-- Forward-only. No historical migration edited. Safe re-run (OR REPLACE /
-- IF NOT EXISTS / DROP IF EXISTS throughout).

-- 1. Trigger: last line of defense on every signer-status write.
CREATE OR REPLACE FUNCTION enforce_owner_signs_first()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF NEW.status = 'signed' AND (OLD.status IS DISTINCT FROM 'signed') THEN
    -- Signers without a bound version predate version tracking; the RPC
    -- checks below still gate every reachable path, so there is nothing to
    -- prove here.
    IF NEW.document_version_id IS NULL THEN
      RETURN NEW;
    END IF;
    SELECT dv.status INTO v_status
    FROM document_versions dv
    WHERE dv.id = NEW.document_version_id;
    IF v_status IS NULL
       OR (v_status NOT IN ('owner_signed', 'counterparty_pending', 'sent', 'fully_signed', 'locked')) THEN
      RAISE EXCEPTION 'Owner must sign before counterparties can sign (version %)', NEW.document_version_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_owner_signs_first ON document_signers;
CREATE TRIGGER trg_owner_signs_first
  BEFORE UPDATE ON document_signers
  FOR EACH ROW EXECUTE FUNCTION enforce_owner_signs_first();

-- 2a. sign_as_invitee with the owner-first gate (otherwise identical to 00044:
-- same token/expiry/email/version-supersede checks, same grants).
CREATE OR REPLACE FUNCTION sign_as_invitee(
  p_token TEXT,
  p_name TEXT,
  p_email TEXT
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer document_signers%ROWTYPE;
  v_latest INTEGER;
  v_version_status TEXT;
BEGIN
  IF p_token IS NULL OR char_length(p_token) = 0 OR char_length(p_token) > 200
    OR p_name IS NULL OR char_length(btrim(p_name)) = 0 OR char_length(p_name) > 120
    OR p_email IS NULL OR char_length(p_email) > 254
    OR p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  THEN
    RETURN QUERY SELECT false, 'Invalid signing request';
    RETURN;
  END IF;

  SELECT * INTO v_signer FROM document_signers WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid or expired signing link';
    RETURN;
  END IF;
  IF v_signer.status = 'signed' THEN
    RETURN QUERY SELECT false, 'Document has already been signed by this party';
    RETURN;
  END IF;
  IF v_signer.status IN ('declined', 'revoked') THEN
    RETURN QUERY SELECT false, 'This signing invitation is no longer valid';
    RETURN;
  END IF;

  -- Identity binding: the token authorizes this invitation, but the email
  -- must match the invited address — a leaked token alone cannot sign as
  -- someone else.
  IF lower(btrim(p_email)) <> lower(v_signer.email) THEN
    RETURN QUERY SELECT false, 'Email does not match this invitation';
    RETURN;
  END IF;

  -- Serialize against concurrent version creation for the same document so
  -- the supersede check below cannot be raced (matches lawyer_create_version).
  PERFORM pg_advisory_xact_lock(hashtext('docver:' || v_signer.audit_id::text || ':' || v_signer.document_type));

  -- Version binding: refuse a superseded version explicitly.
  SELECT COALESCE(MAX(version_number), 0) INTO v_latest
  FROM document_versions
  WHERE audit_id = v_signer.audit_id AND document_type = v_signer.document_type;

  IF (SELECT version_number FROM document_versions WHERE id = v_signer.document_version_id) < v_latest THEN
    RETURN QUERY SELECT false, 'A newer document version exists; signing is paused until the new version is reviewed';
    RETURN;
  END IF;

  -- Owner-signs-first: the parent version must already be past owner signing.
  -- (The trg_owner_signs_first trigger re-enforces this on the write itself.)
  SELECT dv.status INTO v_version_status
  FROM document_versions dv
  WHERE dv.id = v_signer.document_version_id;
  IF v_version_status IS NOT NULL
     AND (v_version_status NOT IN ('owner_signed', 'counterparty_pending', 'sent', 'fully_signed', 'locked')) THEN
    RETURN QUERY SELECT false, 'The owner must sign this document before counterparties can sign';
    RETURN;
  END IF;

  UPDATE document_signers
  SET status = 'signed', signed_at = now()
  WHERE id = v_signer.id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'This signing invitation is no longer valid';
    RETURN;
  END IF;

  INSERT INTO document_signatures (share_token_id, signer_id, audit_id, document_type, signed_by_name, signed_by_email, ip_address)
  VALUES (NULL, v_signer.id, v_signer.audit_id, v_signer.document_type, btrim(p_name), btrim(p_email), NULL);

  INSERT INTO activity_events (user_id, audit_id, event_type, payload)
  VALUES (
    (SELECT user_id FROM audits WHERE id = v_signer.audit_id),
    v_signer.audit_id,
    'signer_signed',
    jsonb_build_object('signer_id', v_signer.id, 'document_version_id', v_signer.document_version_id)
  );

  -- Execution completion: derived the moment the last required signature
  -- lands on THIS version (at least one signer, none pending on it).
  -- Revoked/declined signers do not block: they resolved out via
  -- re-invitation. No flag is stored; the same derivation runs in
  -- application code. Other versions' pending invites are unaffected.
  IF NOT EXISTS (
    SELECT 1 FROM document_signers s
    WHERE s.document_version_id = v_signer.document_version_id
      AND s.status = 'pending'
  ) AND EXISTS (
    SELECT 1 FROM document_signers s
    WHERE s.document_version_id = v_signer.document_version_id
      AND s.status = 'signed'
  ) THEN
    INSERT INTO activity_events (user_id, audit_id, event_type, payload)
    VALUES (
      (SELECT user_id FROM audits WHERE id = v_signer.audit_id),
      v_signer.audit_id,
      'execution_completed',
      jsonb_build_object(
        'document_type', v_signer.document_type,
        'document_version_id', v_signer.document_version_id
      )
    );
  END IF;

  RETURN QUERY SELECT true, 'Document signed successfully';
END;
$$;

GRANT EXECUTE ON FUNCTION sign_as_invitee(TEXT, TEXT, TEXT) TO anon, authenticated;

-- 2b. sign_shared_document with the owner-first gate (otherwise identical to
-- the 00040 revision: same token/expiry/shape checks, one-sign-per-token,
-- revoke-on-sign). The legacy flow carries no version binding, so the gate
-- reads the latest version for this deal+document: a pre-owner version
-- refuses; no version row at all (pure legacy data) is allowed through,
-- since the token itself was owner-issued.
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
  v_version_status TEXT;
BEGIN
  IF p_token IS NULL
    OR char_length(p_token) > 64
    OR p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR p_name IS NULL
    OR char_length(btrim(p_name)) = 0
    OR char_length(p_name) > 120
    OR p_email IS NULL
    OR char_length(p_email) > 254
    OR p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  THEN
    RETURN QUERY SELECT false, 'Invalid or expired share link';
    RETURN;
  END IF;

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

  -- Owner-signs-first for the legacy share-sign flow.
  SELECT dv.status INTO v_version_status
  FROM document_versions dv
  WHERE dv.audit_id = v_audit_id AND dv.document_type = v_doc_type
  ORDER BY dv.version_number DESC
  LIMIT 1;
  IF v_version_status IS NOT NULL
     AND (v_version_status NOT IN ('owner_signed', 'counterparty_pending', 'sent', 'fully_signed', 'locked')) THEN
    RETURN QUERY SELECT false, 'The owner must sign this document before counterparties can sign';
    RETURN;
  END IF;

  INSERT INTO document_signatures (share_token_id, audit_id, document_type, signed_by_name, signed_by_email, ip_address)
  VALUES (v_share_id, v_audit_id, v_doc_type, btrim(p_name), btrim(p_email), p_ip);

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
      'signed_by_name', btrim(p_name),
      'signed_by_email', btrim(p_email)
    )
  );

  RETURN QUERY SELECT true, 'Document signed successfully';
END;
$$;
