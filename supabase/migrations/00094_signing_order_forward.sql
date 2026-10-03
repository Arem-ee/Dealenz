-- 00094: signing order, clean expiry messages, invitee forwarding.
--
-- Closes the three gaps the v1 ceremony left open:
--
-- 1. Signing order. Counterparties signed in parallel only. sign_order
--    groups signers into ordered steps (same number = same step, signs in
--    parallel; lower numbers sign first). The owner is always order 0 and
--    never blocked. Enforcement lives inside the two sign RPCs so every
--    path (new UI, legacy routes, raw SQL-adjacent writes) honors it
--    identically; the advisory lock both RPCs already take serializes
--    concurrent same-step signers.
-- 2. Clean expiry. The 00090 trigger rejects lapsed pending->signed flips
--    with a raw exception. Both sign RPCs now check expiry first and return
--    the same 'This signing invitation has expired' message row, so users
--    see a sentence instead of a 500. The trigger stays as backstop.
-- 3. Forwarding. forward_invite lets a pending invitee assign their step
--    to a colleague (sender-controlled via the ceremony's allowForward
--    flag): the old row revokes, the new row inherits step + expiry, and
--    the audit trail records the handoff. Email binding re-validates on
--    the new address, and the new address must not already hold a live
--    invitation on the ceremony.
--
-- Forward-only, additive: nullable-safe column with a default (existing
-- rows all behave as order 0 = today's parallel semantics), widened
-- RETURNS TABLE on get_signer_view (new columns appended), no RLS change.

ALTER TABLE document_signers
  ADD COLUMN IF NOT EXISTS sign_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_document_signers_version_order
  ON document_signers (document_version_id, sign_order) WHERE status = 'pending';

-- Shared order gate: a signer may sign only when no pending signer on the
-- same version holds a lower order. Owner (order 0) always passes.
CREATE OR REPLACE FUNCTION signing_order_clear(p_version_id UUID, p_order INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM document_signers s
    WHERE s.document_version_id = p_version_id
      AND s.status = 'pending'
      AND s.sign_order < p_order
  );
END;
$$;

-- sign_as_invitee with the owner-first gate (otherwise identical to the
-- 00070 revision: same token/email/version checks, same grants), plus the
-- order gate and a clean expiry message ahead of the 00090 trigger.
-- DROP first: widened checks keep the signature, but the companion
-- get_signer_view below changes its return type, which OR REPLACE
-- forbids (42P13). Grants are re-issued after each definition.
DROP FUNCTION IF EXISTS sign_as_invitee(TEXT, TEXT, TEXT);
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
  IF v_signer.status IN ('declined', 'revoked', 'expired') THEN
    RETURN QUERY SELECT false, 'This signing invitation is no longer valid';
    RETURN;
  END IF;

  -- Clean expiry ahead of the 00090 trigger: the user gets a sentence,
  -- and the nightly pass later flips the row to 'expired' for the queues.
  IF v_signer.expires_at IS NOT NULL AND v_signer.expires_at <= now() THEN
    RETURN QUERY SELECT false, 'This signing invitation has expired';
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

  -- Signing order: earlier steps sign first. Same-step signers proceed in
  -- parallel; the advisory lock above serializes the race.
  IF NOT signing_order_clear(v_signer.document_version_id, v_signer.sign_order) THEN
    RETURN QUERY SELECT false, 'Earlier signers must sign first — this step unlocks when theirs is done';
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

-- sign_as_owner v2 (otherwise identical to the 00088 revision: same party
-- binding, same version advancement, same grants) plus the clean expiry
-- message ahead of the 00090 trigger. The owner holds order 0, so the
-- order gate passes trivially and is not re-checked here.
DROP FUNCTION IF EXISTS sign_as_owner(UUID);
CREATE OR REPLACE FUNCTION sign_as_owner(p_signer_id UUID)
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
  SELECT * INTO v_signer FROM document_signers WHERE id = p_signer_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Signer not found';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM audits a WHERE a.id = v_signer.audit_id AND a.user_id = auth.uid()) THEN
    RETURN QUERY SELECT false, 'Not your deal';
    RETURN;
  END IF;
  IF v_signer.party_label NOT IN ('owner', 'Owner') THEN
    RETURN QUERY SELECT false, 'Only the owner signature can be recorded here';
    RETURN;
  END IF;
  IF v_signer.status <> 'pending' THEN
    RETURN QUERY SELECT false, 'Only pending invitations can be signed';
    RETURN;
  END IF;
  -- Clean expiry ahead of the 00090 trigger.
  IF v_signer.expires_at IS NOT NULL AND v_signer.expires_at <= now() THEN
    RETURN QUERY SELECT false, 'This signing invitation has expired';
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('docver:' || v_signer.audit_id::text || ':' || v_signer.document_type));
  SELECT COALESCE(MAX(version_number),0) INTO v_latest FROM document_versions WHERE audit_id = v_signer.audit_id AND document_type = v_signer.document_type;
  IF (SELECT version_number FROM document_versions WHERE id = v_signer.document_version_id) < v_latest THEN
    RETURN QUERY SELECT false, 'A newer version exists; signing is paused';
    RETURN;
  END IF;
  -- Advance the version along legal arms BEFORE flipping the signer, so the
  -- owner-first trigger observes an owner_signed version and passes.
  SELECT status INTO v_version_status FROM document_versions WHERE id = v_signer.document_version_id;
  IF v_version_status = 'draft' THEN
    UPDATE document_versions SET status = 'ready_to_sign', updated_at = now() WHERE id = v_signer.document_version_id;
    v_version_status := 'ready_to_sign';
  END IF;
  IF v_version_status IN ('ready_to_sign', 'ready_to_send') THEN
    UPDATE document_versions SET status = 'owner_signed', owner_signed_at = now(), updated_at = now() WHERE id = v_signer.document_version_id;
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

GRANT EXECUTE ON FUNCTION sign_as_owner(UUID) TO authenticated;

-- get_signer_view with expiry, order, queue position, and the forwarding
-- flag appended (existing columns untouched and in order).
-- earlier_pending counts live pending signers on earlier steps and
-- allow_forward mirrors the ceremony flag — both are counts/flags, so no
-- identities leak.
-- DROP first: four columns are appended to the return type, which
-- CREATE OR REPLACE forbids on an existing function (42P13).
DROP FUNCTION IF EXISTS get_signer_view(TEXT);
CREATE OR REPLACE FUNCTION get_signer_view(p_token TEXT)
RETURNS TABLE (
  signer_name TEXT,
  signer_email TEXT,
  party_label TEXT,
  sign_status TEXT,
  signed_at TIMESTAMPTZ,
  document_type TEXT,
  version_number INTEGER,
  content TEXT,
  superseded BOOLEAN,
  total_signers INTEGER,
  signed_signers INTEGER,
  expires_at TIMESTAMPTZ,
  sign_order INTEGER,
  earlier_pending INTEGER,
  allow_forward BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer document_signers%ROWTYPE;
  v_content TEXT;
  v_number INTEGER;
  v_latest INTEGER;
  v_allow_forward BOOLEAN;
BEGIN
  IF p_token IS NULL OR char_length(p_token) = 0 OR char_length(p_token) > 200 THEN
    RETURN;
  END IF;

  SELECT * INTO v_signer FROM document_signers WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT dv.content, dv.version_number,
    COALESCE((dv.signing_provenance->>'allowForward')::BOOLEAN, true)
  INTO v_content, v_number, v_allow_forward
  FROM document_versions dv WHERE dv.id = v_signer.document_version_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) INTO v_latest
  FROM document_versions
  WHERE audit_id = v_signer.audit_id AND document_type = v_signer.document_type;

  RETURN QUERY SELECT
    v_signer.name, v_signer.email, v_signer.party_label,
    v_signer.status, v_signer.signed_at,
    v_signer.document_type, v_number, v_content,
    (v_number < v_latest),
    -- Aggregate counts only (no other signer's identity): lets the invitee
    -- see "2 of 3 complete" and the executed state without leaking PII.
    (SELECT COUNT(*)::INTEGER FROM document_signers s
      WHERE s.document_version_id = v_signer.document_version_id
        AND s.status <> 'revoked'),
    (SELECT COUNT(*)::INTEGER FROM document_signers s
      WHERE s.document_version_id = v_signer.document_version_id
        AND s.status = 'signed'),
    v_signer.expires_at,
    v_signer.sign_order,
    (SELECT COUNT(*)::INTEGER FROM document_signers s
      WHERE s.document_version_id = v_signer.document_version_id
        AND s.status = 'pending'
        AND s.sign_order < v_signer.sign_order),
    v_allow_forward;
END;
$$;

GRANT EXECUTE ON FUNCTION get_signer_view TO anon, authenticated;

-- Invitee forwarding: a pending invitee assigns their step to a colleague.
-- Sender-controlled: the ceremony's signing_provenance.allowForward must
-- not be false (absent counts as allowed — forwarding is standard, and the
-- old row revokes so no signature power duplicates). The new row inherits
-- the step and expiry; forwarding never extends a deadline. Returns the
-- fresh token so the forwarder can hand the new invitee their link; the
-- handoff is recorded for the owner in activity_events.
CREATE OR REPLACE FUNCTION forward_invite(
  p_token TEXT,
  p_name TEXT,
  p_email TEXT
)
RETURNS TABLE (success BOOLEAN, message TEXT, new_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer document_signers%ROWTYPE;
  v_latest INTEGER;
  v_allow_forward BOOLEAN;
  v_new_token TEXT;
BEGIN
  IF p_token IS NULL OR char_length(p_token) = 0 OR char_length(p_token) > 200
    OR p_name IS NULL OR char_length(btrim(p_name)) = 0 OR char_length(p_name) > 120
    OR p_email IS NULL OR char_length(p_email) > 254
    OR p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  THEN
    RETURN QUERY SELECT false, 'Invalid forwarding request', NULL::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_signer FROM document_signers WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid or expired signing link', NULL::TEXT;
    RETURN;
  END IF;
  IF v_signer.status <> 'pending' THEN
    RETURN QUERY SELECT false, 'Only pending invitations can be forwarded', NULL::TEXT;
    RETURN;
  END IF;
  IF v_signer.expires_at IS NOT NULL AND v_signer.expires_at <= now() THEN
    RETURN QUERY SELECT false, 'This signing invitation has expired', NULL::TEXT;
    RETURN;
  END IF;
  IF v_signer.party_label IN ('owner', 'Owner') THEN
    RETURN QUERY SELECT false, 'The owner step cannot be forwarded', NULL::TEXT;
    RETURN;
  END IF;

  -- Sender control lives on the ceremony, not the invitee. Absent counts
  -- as allowed: forwarding is standard, and the old row revokes so no
  -- signature power duplicates.
  SELECT COALESCE(
    ((SELECT signing_provenance FROM document_versions WHERE id = v_signer.document_version_id)->>'allowForward')::BOOLEAN,
    true
  ) INTO v_allow_forward;
  IF NOT v_allow_forward THEN
    RETURN QUERY SELECT false, 'Forwarding is disabled for this document', NULL::TEXT;
    RETURN;
  END IF;

  -- The new address must not already hold a live invitation here, and must
  -- not be the same address (that is a resend, not a forward).
  IF lower(btrim(p_email)) = lower(v_signer.email) THEN
    RETURN QUERY SELECT false, 'That is already the invited address — resend instead', NULL::TEXT;
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM document_signers s
    WHERE s.document_version_id = v_signer.document_version_id
      AND lower(s.email) = lower(btrim(p_email))
      AND s.status IN ('pending', 'signed')
  ) THEN
    RETURN QUERY SELECT false, 'That address already has an invitation on this document', NULL::TEXT;
    RETURN;
  END IF;

  -- Version binding: no forwarding off a superseded version.
  SELECT COALESCE(MAX(version_number), 0) INTO v_latest
  FROM document_versions
  WHERE audit_id = v_signer.audit_id AND document_type = v_signer.document_type;
  IF (SELECT version_number FROM document_versions WHERE id = v_signer.document_version_id) < v_latest THEN
    RETURN QUERY SELECT false, 'A newer document version exists; signing is paused until the new version is reviewed', NULL::TEXT;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('docver:' || v_signer.audit_id::text || ':' || v_signer.document_type));

  -- Re-check liveness under the lock, then swap: revoke the old row first
  -- so the step is never double-held, even on a raced double-forward.
  UPDATE document_signers SET status = 'revoked' WHERE id = v_signer.id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'This signing invitation is no longer valid', NULL::TEXT;
    RETURN;
  END IF;

  v_new_token := replace(gen_random_uuid()::text, '-', '')
    || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO document_signers (
    audit_id, document_type, document_version_id,
    name, email, party_label, token, status, sign_order, expires_at
  ) VALUES (
    v_signer.audit_id, v_signer.document_type, v_signer.document_version_id,
    btrim(p_name), lower(btrim(p_email)), v_signer.party_label,
    v_new_token, 'pending', v_signer.sign_order, v_signer.expires_at
  );

  INSERT INTO activity_events (user_id, audit_id, event_type, payload)
  VALUES (
    (SELECT user_id FROM audits WHERE id = v_signer.audit_id),
    v_signer.audit_id,
    'invite_forwarded',
    jsonb_build_object(
      'from_signer_id', v_signer.id,
      'from_email', v_signer.email,
      'to_email', lower(btrim(p_email)),
      'document_version_id', v_signer.document_version_id
    )
  );

  RETURN QUERY SELECT true, 'Invitation forwarded', v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION forward_invite(TEXT, TEXT, TEXT) TO anon, authenticated;

-- Invitee signature images: token-gated artifact writes. Invitees are
-- unauthenticated, so no RLS write policy could scope them — this
-- SECURITY DEFINER function verifies token + email + liveness + version
-- currency first, then upserts the single artifact row for that signer.
-- Shape validation (data-URL form) runs in the application route; length
-- and method are re-checked here so direct RPC callers cannot smuggle
-- oversized or mistyped rows past the CHECK constraints as errors — they
-- get message rows instead. Artifact-first: the image lands before the
-- sign RPC flips the status, so a recorded signature always has its image.
CREATE OR REPLACE FUNCTION save_signature_artifact(
  p_token TEXT,
  p_email TEXT,
  p_image_data TEXT,
  p_method TEXT
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer document_signers%ROWTYPE;
  v_latest INTEGER;
BEGIN
  IF p_token IS NULL OR char_length(p_token) = 0 OR char_length(p_token) > 200
    OR p_email IS NULL OR char_length(p_email) > 254
    OR p_image_data IS NULL OR char_length(p_image_data) NOT BETWEEN 100 AND 70000
    OR p_method NOT IN ('drawn', 'typed', 'uploaded')
  THEN
    RETURN QUERY SELECT false, 'Invalid signature image';
    RETURN;
  END IF;

  SELECT * INTO v_signer FROM document_signers WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid or expired signing link';
    RETURN;
  END IF;
  IF v_signer.status <> 'pending' THEN
    RETURN QUERY SELECT false, 'This signing invitation is no longer valid';
    RETURN;
  END IF;
  IF v_signer.expires_at IS NOT NULL AND v_signer.expires_at <= now() THEN
    RETURN QUERY SELECT false, 'This signing invitation has expired';
    RETURN;
  END IF;
  IF lower(btrim(p_email)) <> lower(v_signer.email) THEN
    RETURN QUERY SELECT false, 'Email does not match this invitation';
    RETURN;
  END IF;

  -- No images onto superseded versions: the invitee reviews the current
  -- text before anything is recorded.
  SELECT COALESCE(MAX(version_number), 0) INTO v_latest
  FROM document_versions
  WHERE audit_id = v_signer.audit_id AND document_type = v_signer.document_type;
  IF (SELECT version_number FROM document_versions WHERE id = v_signer.document_version_id) < v_latest THEN
    RETURN QUERY SELECT false, 'A newer document version exists; signing is paused until the new version is reviewed';
    RETURN;
  END IF;

  INSERT INTO signer_signature_artifacts (signer_id, image_data, method)
  VALUES (v_signer.id, p_image_data, p_method)
  ON CONFLICT (signer_id) DO UPDATE
  SET image_data = EXCLUDED.image_data, method = EXCLUDED.method, created_at = now();

  RETURN QUERY SELECT true, 'Signature image saved';
END;
$$;

GRANT EXECUTE ON FUNCTION save_signature_artifact(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
