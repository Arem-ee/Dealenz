-- Closure verification: redraft hash inconsistency (MD5 vs SHA-256)
-- Ensure exactly one hash algorithm (SHA-256) and one version allocation strategy.
-- Previous RPC used md5(p_content); app path now uses sha256. Unify to SHA-256 everywhere.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION create_redraft_version(p_source_version_id UUID, p_content TEXT, p_change_summary TEXT, p_idempotency_key TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT, new_version_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source document_versions%ROWTYPE;
  v_audit audits%ROWTYPE;
  v_existing signing_events%ROWTYPE;
  v_new_id UUID;
  v_hash TEXT;
BEGIN
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) < 10 THEN
    RETURN QUERY SELECT false, 'Invalid idempotency key'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  SELECT * INTO v_source FROM document_versions WHERE id = p_source_version_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Source version not found'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  SELECT * INTO v_audit FROM audits WHERE id = v_source.audit_id;
  IF NOT FOUND OR v_audit.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN QUERY SELECT false, 'Not your deal'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  -- One redraft integrity model: app path (redraftFromLocked) allows
  -- locked/fully_signed/superseded only. 'sent' is legacy counterparty_pending
  -- (not yet fully signed) and must not redraft. Duplicate entry removed.
  IF v_source.status NOT IN ('locked','fully_signed','superseded') THEN
    RETURN QUERY SELECT false, format('Cannot redraft from status %s', v_source.status)::TEXT, NULL::UUID;
    RETURN;
  END IF;
  SELECT * INTO v_existing FROM signing_events WHERE audit_id = v_audit.id AND document_version_id = p_source_version_id AND idempotency_key = p_idempotency_key AND event_type='redraft';
  IF FOUND THEN
    SELECT id INTO v_new_id FROM document_versions WHERE parent_version_id = p_source_version_id AND provenance->>'redraft_key' = p_idempotency_key ORDER BY version_number DESC LIMIT 1;
    RETURN QUERY SELECT true, 'Already redrafted (idempotent)'::TEXT, v_new_id;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('redraft:' || p_source_version_id::text || ':' || p_idempotency_key));
  -- Use pgcrypto digest for SHA-256 (requires pgcrypto extension)
  PERFORM 1 FROM pg_extension WHERE extname = 'pgcrypto';
  IF NOT FOUND THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
  v_hash := encode(digest(p_content::bytea, 'sha256'), 'hex');
  INSERT INTO document_versions (audit_id, user_id, document_type, version_number, content, generation_method, parent_version_id, content_hash, provenance, status, work_product_id)
  VALUES (
    v_source.audit_id, auth.uid(), v_source.document_type,
    (SELECT COALESCE(MAX(version_number),0)+1 FROM document_versions WHERE audit_id = v_source.audit_id AND document_type = v_source.document_type),
    p_content, 'assembled', p_source_version_id, v_hash,
    jsonb_build_object('redraft_from', p_source_version_id, 'redraft_key', p_idempotency_key, 'change_summary', COALESCE(p_change_summary,''), 'source_hash', v_source.content_hash, 'created_via', 'redraft'),
    'draft', NULL
  ) RETURNING id INTO v_new_id;
  UPDATE document_versions SET status='superseded', updated_at=now() WHERE id = p_source_version_id AND status='locked';
  INSERT INTO signing_events (audit_id, document_version_id, user_id, event_type, document_hash, provenance, idempotency_key)
  VALUES (v_audit.id, p_source_version_id, auth.uid(), 'redraft', v_source.content_hash, jsonb_build_object('new_version_id', v_new_id, 'change_summary', COALESCE(p_change_summary,'')), p_idempotency_key);
  INSERT INTO activity_events (user_id, audit_id, event_type, payload) VALUES (auth.uid(), v_audit.id, 'document_redraft', jsonb_build_object('source_version_id', p_source_version_id, 'new_version_id', v_new_id));
  RETURN QUERY SELECT true, 'Redraft created'::TEXT, v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_redraft_version(UUID, TEXT, TEXT, TEXT) TO authenticated;
