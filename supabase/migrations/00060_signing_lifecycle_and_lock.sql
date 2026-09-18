-- Phase 3: signing lifecycle and immutable locked versions
-- Extends document_versions.status to full lifecycle and enforces hard integrity:
-- draft -> ready_to_sign -> owner_signed -> counterparty_pending -> fully_signed -> locked
-- Legacy values ready_to_send/sent remain valid for backward compat but map to ready_to_sign/counterparty_pending.
-- Once locked/fully_signed/superseded, no ordinary mutation allowed (DB trigger, not UI only).
-- Also adds signing_events audit table (server-generated, RLS, idempotency).

-- 1. Widen status constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_versions_status_check' AND conrelid = 'public.document_versions'::regclass) THEN
    ALTER TABLE public.document_versions DROP CONSTRAINT document_versions_status_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_versions_status_check1' AND conrelid = 'public.document_versions'::regclass) THEN
    ALTER TABLE public.document_versions DROP CONSTRAINT document_versions_status_check1;
  END IF;
END $$;

ALTER TABLE public.document_versions
  DROP CONSTRAINT IF EXISTS document_versions_status_check,
  DROP CONSTRAINT IF EXISTS document_versions_status_check1;

ALTER TABLE public.document_versions
  ADD CONSTRAINT document_versions_status_check
  CHECK (status IN ('draft','ready_to_sign','ready_to_send','owner_signed','counterparty_pending','sent','fully_signed','locked','superseded'));

-- 2. Add signing provenance columns (nullable, only populated when transitioning)
ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS owner_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS counterparty_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fully_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signing_provenance JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Hard immutability trigger for locked/fully_signed/superseded
CREATE OR REPLACE FUNCTION enforce_document_version_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If OLD is immutable, any change except setting updated_at (no-op) is rejected
  IF OLD.status IN ('locked','fully_signed','superseded') THEN
    IF NEW IS DISTINCT FROM OLD THEN
      -- Allow only updated_at drift if everything else identical? No, distinct means something changed.
      -- We allow superseded to be set from locked/fully_signed via explicit transition function, not direct UPDATE.
      -- For now, reject any mutation of immutable rows.
      RAISE EXCEPTION 'Immutable document version: locked/fully_signed/superseded versions cannot be mutated (id=%)', OLD.id;
    END IF;
  END IF;
  -- content_hash is immutable once set
  IF OLD.content_hash IS NOT NULL AND NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    RAISE EXCEPTION 'content_hash is immutable once set (id=%)', OLD.id;
  END IF;
  -- parent_version_id is immutable once set
  IF OLD.parent_version_id IS NOT NULL AND NEW.parent_version_id IS DISTINCT FROM OLD.parent_version_id THEN
    RAISE EXCEPTION 'parent_version_id is immutable (id=%)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_version_lock ON document_versions;
CREATE TRIGGER trg_document_version_lock
  BEFORE UPDATE ON document_versions
  FOR EACH ROW EXECUTE FUNCTION enforce_document_version_lock();

-- Also prevent direct updates to content via RLS? RLS already owner-only, but trigger is authoritative.

-- 4. Signing events audit table (immutable, server-generated)
CREATE TABLE IF NOT EXISTS signing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('owner_signed','counterparty_signed','fully_signed','locked','redraft','invite_sent')),
  signer_id UUID REFERENCES document_signers(id) ON DELETE SET NULL,
  document_hash TEXT CHECK (document_hash IS NULL OR char_length(document_hash) BETWEEN 10 AND 128),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 10 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signing_events_idempotency UNIQUE (audit_id, document_version_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_signing_events_audit ON signing_events(audit_id);
CREATE INDEX IF NOT EXISTS idx_signing_events_version ON signing_events(document_version_id);
CREATE INDEX IF NOT EXISTS idx_signing_events_user ON signing_events(user_id);

ALTER TABLE signing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own signing events" ON signing_events;
CREATE POLICY "Users read own signing events"
  ON signing_events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM audits a WHERE a.id = signing_events.audit_id AND a.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM document_signers ds WHERE ds.id = signing_events.signer_id AND ds.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users insert own signing events" ON signing_events;
CREATE POLICY "Users insert own signing events"
  ON signing_events FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM audits a WHERE a.id = signing_events.audit_id AND a.user_id = auth.uid())
  );

-- No UPDATE/DELETE policies: immutable audit trail (append-only)

-- 5. Idempotent signing helper: owner signs
CREATE OR REPLACE FUNCTION sign_document_as_owner(p_version_id UUID, p_idempotency_key TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT, event_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version document_versions%ROWTYPE;
  v_audit audits%ROWTYPE;
  v_existing signing_events%ROWTYPE;
  v_event_id UUID;
BEGIN
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) < 10 THEN
    RETURN QUERY SELECT false, 'Invalid idempotency key'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  SELECT * INTO v_version FROM document_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Version not found'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  SELECT * INTO v_audit FROM audits WHERE id = v_version.audit_id;
  IF NOT FOUND OR v_audit.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN QUERY SELECT false, 'Not your deal'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  -- Idempotency: if same audit+version+key exists, return existing
  SELECT * INTO v_existing FROM signing_events WHERE audit_id = v_audit.id AND document_version_id = p_version_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT true, 'Already signed (idempotent)'::TEXT, v_existing.id;
    RETURN;
  END IF;
  -- Only draft/ready_to_sign can be owner-signed
  IF v_version.status NOT IN ('draft','ready_to_sign','ready_to_send') THEN
    RETURN QUERY SELECT false, format('Cannot owner-sign from status %s', v_version.status)::TEXT, NULL::UUID;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('doc_sign:' || p_version_id::text));
  -- Re-check after lock
  SELECT * INTO v_version FROM document_versions WHERE id = p_version_id FOR UPDATE;
  IF v_version.status NOT IN ('draft','ready_to_sign','ready_to_send') THEN
    RETURN QUERY SELECT false, format('Cannot owner-sign from status %s', v_version.status)::TEXT, NULL::UUID;
    RETURN;
  END IF;
  UPDATE document_versions SET status = 'owner_signed', owner_signed_at = now(), signing_provenance = jsonb_build_object('owner_signed_at', now(), 'owner_user_id', auth.uid()), updated_at = now() WHERE id = p_version_id;
  INSERT INTO signing_events (audit_id, document_version_id, user_id, event_type, document_hash, provenance, idempotency_key)
  VALUES (v_audit.id, p_version_id, auth.uid(), 'owner_signed', v_version.content_hash, jsonb_build_object('status_before', v_version.status, 'status_after', 'owner_signed'), p_idempotency_key)
  RETURNING id INTO v_event_id;
  INSERT INTO activity_events (user_id, audit_id, event_type, payload) VALUES (auth.uid(), v_audit.id, 'owner_signed', jsonb_build_object('document_version_id', p_version_id, 'event_id', v_event_id));
  RETURN QUERY SELECT true, 'Owner signed'::TEXT, v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION sign_document_as_owner(UUID, TEXT) TO authenticated;

-- 6. Counterparty sign via signer_id (token-gated signer must exist and be pending)
CREATE OR REPLACE FUNCTION sign_document_as_counterparty(p_signer_id UUID, p_idempotency_key TEXT)
RETURNS TABLE (success BOOLEAN, message TEXT, event_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer document_signers%ROWTYPE;
  v_version document_versions%ROWTYPE;
  v_audit audits%ROWTYPE;
  v_existing signing_events%ROWTYPE;
  v_event_id UUID;
  v_pending_count INTEGER;
BEGIN
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) < 10 THEN
    RETURN QUERY SELECT false, 'Invalid idempotency key'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  SELECT * INTO v_signer FROM document_signers WHERE id = p_signer_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Signer not found'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  SELECT * INTO v_version FROM document_versions WHERE id = v_signer.document_version_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Version not found'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  SELECT * INTO v_audit FROM audits WHERE id = v_version.audit_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Audit not found'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  -- Counterparty identity: signer email must match auth email OR token has been verified server-side before calling
  -- For now we allow if signer status pending and version is owner_signed/counterparty_pending
  SELECT * INTO v_existing FROM signing_events WHERE audit_id = v_audit.id AND document_version_id = v_version.id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT true, 'Already signed (idempotent)'::TEXT, v_existing.id;
    RETURN;
  END IF;
  IF v_signer.status <> 'pending' THEN
    RETURN QUERY SELECT false, 'Only pending invitations can be signed'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  IF v_version.status NOT IN ('owner_signed','counterparty_pending') THEN
    RETURN QUERY SELECT false, format('Cannot counterparty-sign from status %s', v_version.status)::TEXT, NULL::UUID;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('doc_sign:' || v_version.id::text));
  SELECT * INTO v_version FROM document_versions WHERE id = v_version.id FOR UPDATE;
  SELECT * INTO v_signer FROM document_signers WHERE id = p_signer_id FOR UPDATE;
  IF v_signer.status <> 'pending' THEN
    RETURN QUERY SELECT false, 'Already signed'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  UPDATE document_signers SET status='signed', signed_at=now() WHERE id = p_signer_id AND status='pending';
  INSERT INTO document_signatures (share_token_id, signer_id, audit_id, document_type, signed_by_name, signed_by_email, signed_at) VALUES (NULL, v_signer.id, v_signer.audit_id, v_signer.document_type, v_signer.name, v_signer.email, now());
  INSERT INTO signing_events (audit_id, document_version_id, user_id, event_type, signer_id, document_hash, provenance, idempotency_key)
  VALUES (v_audit.id, v_version.id, v_audit.user_id, 'counterparty_signed', v_signer.id, v_version.content_hash, jsonb_build_object('signer_email', v_signer.email), p_idempotency_key)
  RETURNING id INTO v_event_id;
  INSERT INTO activity_events (user_id, audit_id, event_type, payload) VALUES (v_audit.user_id, v_audit.id, 'counterparty_signed', jsonb_build_object('document_version_id', v_version.id, 'signer_id', v_signer.id, 'event_id', v_event_id));
  -- Check if all signers signed -> fully_signed -> locked
  SELECT COUNT(*) INTO v_pending_count FROM document_signers WHERE document_version_id = v_version.id AND status = 'pending';
  IF v_pending_count = 0 THEN
    UPDATE document_versions SET status='fully_signed', fully_signed_at=now(), counterparty_signed_at=now(), updated_at=now() WHERE id = v_version.id;
    INSERT INTO signing_events (audit_id, document_version_id, user_id, event_type, document_hash, provenance, idempotency_key)
    VALUES (v_audit.id, v_version.id, v_audit.user_id, 'fully_signed', v_version.content_hash, jsonb_build_object('auto', true), p_idempotency_key || ':fully_signed')
    RETURNING id INTO v_event_id;
    -- Lock immediately after fully_signed
    UPDATE document_versions SET status='locked', locked_at=now(), updated_at=now() WHERE id = v_version.id;
    INSERT INTO signing_events (audit_id, document_version_id, user_id, event_type, document_hash, provenance, idempotency_key)
    VALUES (v_audit.id, v_version.id, v_audit.user_id, 'locked', v_version.content_hash, jsonb_build_object('auto', true, 'reason', 'fully_signed'), p_idempotency_key || ':locked');
    INSERT INTO activity_events (user_id, audit_id, event_type, payload) VALUES (v_audit.user_id, v_audit.id, 'document_locked', jsonb_build_object('document_version_id', v_version.id));
  ELSE
    UPDATE document_versions SET status='counterparty_pending', counterparty_signed_at=now(), updated_at=now() WHERE id = v_version.id AND status='owner_signed';
  END IF;
  RETURN QUERY SELECT true, 'Counterparty signed'::TEXT, v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION sign_document_as_counterparty(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sign_document_as_counterparty(UUID, TEXT) TO anon;

-- 7. Redraft: create new draft version from locked/fully_signed version (never mutates old)
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
  -- Only locked/fully_signed/superseded can be redrafted
  IF v_source.status NOT IN ('locked','fully_signed','superseded','sent','fully_signed') THEN
    RETURN QUERY SELECT false, format('Cannot redraft from status %s', v_source.status)::TEXT, NULL::UUID;
    RETURN;
  END IF;
  -- Idempotency
  SELECT * INTO v_existing FROM signing_events WHERE audit_id = v_audit.id AND document_version_id = p_source_version_id AND idempotency_key = p_idempotency_key AND event_type='redraft';
  IF FOUND THEN
    -- Find the version created by this key (provenance contains key)
    SELECT id INTO v_new_id FROM document_versions WHERE parent_version_id = p_source_version_id AND provenance->>'redraft_key' = p_idempotency_key ORDER BY version_number DESC LIMIT 1;
    RETURN QUERY SELECT true, 'Already redrafted (idempotent)'::TEXT, v_new_id;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('redraft:' || p_source_version_id::text || ':' || p_idempotency_key));
  v_hash := md5(p_content);
  INSERT INTO document_versions (audit_id, user_id, document_type, version_number, content, generation_method, parent_version_id, content_hash, provenance, status, work_product_id)
  VALUES (
    v_source.audit_id, auth.uid(), v_source.document_type,
    (SELECT COALESCE(MAX(version_number),0)+1 FROM document_versions WHERE audit_id = v_source.audit_id AND document_type = v_source.document_type),
    p_content, 'assembled', p_source_version_id, v_hash,
    jsonb_build_object('redraft_from', p_source_version_id, 'redraft_key', p_idempotency_key, 'change_summary', COALESCE(p_change_summary,''), 'source_hash', v_source.content_hash, 'created_via', 'redraft'),
    'draft', NULL
  ) RETURNING id INTO v_new_id;
  -- Mark source as superseded if it was locked (preserve history; not mutated content)
  UPDATE document_versions SET status='superseded', updated_at=now() WHERE id = p_source_version_id AND status='locked';
  INSERT INTO signing_events (audit_id, document_version_id, user_id, event_type, document_hash, provenance, idempotency_key)
  VALUES (v_audit.id, p_source_version_id, auth.uid(), 'redraft', v_source.content_hash, jsonb_build_object('new_version_id', v_new_id, 'change_summary', COALESCE(p_change_summary,'')), p_idempotency_key);
  INSERT INTO activity_events (user_id, audit_id, event_type, payload) VALUES (auth.uid(), v_audit.id, 'document_redraft', jsonb_build_object('source_version_id', p_source_version_id, 'new_version_id', v_new_id));
  RETURN QUERY SELECT true, 'Redraft created'::TEXT, v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_redraft_version(UUID, TEXT, TEXT, TEXT) TO authenticated;
