-- Allow owners to update their own signers from pending -> signed/declined/revoked
-- (needed for owner-first signing order). Previous policy only allowed read+insert.
CREATE POLICY "Owners update own document signers"
  ON document_signers FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM audits a WHERE a.id = document_signers.audit_id AND a.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM audits a WHERE a.id = document_signers.audit_id AND a.user_id = auth.uid())
  );

-- Owner signing helper: owner signs their own pending invite without a token.
-- Mirrors sign_as_invitee but checks ownership and email match instead of token.
CREATE OR REPLACE FUNCTION sign_as_owner(p_signer_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer document_signers%ROWTYPE;
  v_latest INTEGER;
BEGIN
  SELECT * INTO v_signer FROM document_signers WHERE id = p_signer_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Signer not found';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM audits a WHERE a.id = v_signer.audit_id AND a.user_id = auth.uid()) THEN
    RETURN QUERY SELECT false, 'Not your deal';
    RETURN;
  END IF;
  IF v_signer.status <> 'pending' THEN
    RETURN QUERY SELECT false, 'Only pending invitations can be signed';
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('docver:' || v_signer.audit_id::text || ':' || v_signer.document_type));
  SELECT COALESCE(MAX(version_number),0) INTO v_latest FROM document_versions WHERE audit_id = v_signer.audit_id AND document_type = v_signer.document_type;
  IF (SELECT version_number FROM document_versions WHERE id = v_signer.document_version_id) < v_latest THEN
    RETURN QUERY SELECT false, 'A newer version exists; signing is paused';
    RETURN;
  END IF;
  UPDATE document_signers SET status='signed', signed_at=now() WHERE id = p_signer_id AND status='pending';
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Already signed';
    RETURN;
  END IF;
  INSERT INTO document_signatures (share_token_id, signer_id, audit_id, document_type, signed_by_name, signed_by_email) VALUES (NULL, v_signer.id, v_signer.audit_id, v_signer.document_type, v_signer.name, v_signer.email);
  INSERT INTO activity_events (user_id, audit_id, event_type, payload) VALUES ((SELECT user_id FROM audits WHERE id=v_signer.audit_id), v_signer.audit_id, 'signer_signed', jsonb_build_object('signer_id', v_signer.id, 'document_version_id', v_signer.document_version_id));
  IF NOT EXISTS (SELECT 1 FROM document_signers s WHERE s.document_version_id=v_signer.document_version_id AND s.status='pending') AND EXISTS (SELECT 1 FROM document_signers s WHERE s.document_version_id=v_signer.document_version_id AND s.status='signed') THEN
    INSERT INTO activity_events (user_id, audit_id, event_type, payload) VALUES ((SELECT user_id FROM audits WHERE id=v_signer.audit_id), v_signer.audit_id, 'execution_completed', jsonb_build_object('document_type', v_signer.document_type, 'document_version_id', v_signer.document_version_id));
  END IF;
  RETURN QUERY SELECT true, 'Document signed';
END;
$$;
GRANT EXECUTE ON FUNCTION sign_as_owner TO authenticated;
