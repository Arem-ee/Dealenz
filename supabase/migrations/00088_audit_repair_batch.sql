-- Full-audit repair batch (code audit 2026-09-28). Each section is
-- independent and idempotent (OR REPLACE / IF NOT EXISTS throughout).
-- STAGING: verify on staging before prod (db push).

-- 1. reserve_credits: replay ONLY pending holds. Previously a settled
-- (voided/finalized) idempotency key replayed as allowed=true with the dead
-- reservation id, so resumed plan work executed for free (settlement against
-- a dead id throws and is swallowed). Settled keys now deny; callers mint
-- fresh keys per attempt (executor resume keys carry the attempt number).
CREATE OR REPLACE FUNCTION reserve_credits(
  p_operation TEXT,
  p_amount INTEGER,
  p_idempotency_key TEXT
)
RETURNS TABLE(allowed BOOLEAN, balance INTEGER, reservation_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_balance INTEGER := 0;
  v_existing_id UUID;
  v_existing_status TEXT;
  v_reservation_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 0, NULL::UUID;
    RETURN;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Reservation amount must be positive';
  END IF;
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) = 0 THEN
    RAISE EXCEPTION 'Reservation needs an idempotency key';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:' || v_user_id::text));

  SELECT t.id, t.status INTO v_existing_id, v_existing_status
  FROM credit_ledger t
  WHERE t.user_id = v_user_id AND t.idempotency_key = p_idempotency_key
  ORDER BY t.created_at DESC
  LIMIT 1;

  -- Idempotent replay while the hold is live; settled keys NEVER replay as
  -- live (denial forces a fresh key, never free work).
  IF v_existing_id IS NOT NULL AND v_existing_status = 'pending' THEN
    SELECT b.balance INTO v_balance FROM credit_balance() b;
    RETURN QUERY SELECT true, v_balance, v_existing_id;
    RETURN;
  END IF;
  IF v_existing_id IS NOT NULL THEN
    SELECT b.balance INTO v_balance FROM credit_balance() b;
    RETURN QUERY SELECT false, v_balance, NULL::UUID;
    RETURN;
  END IF;

  SELECT b.balance INTO v_balance FROM credit_balance() b;
  IF v_balance < p_amount THEN
    RETURN QUERY SELECT false, v_balance, NULL::UUID;
    RETURN;
  END IF;

  INSERT INTO credit_ledger (user_id, entry_type, amount, operation, status, idempotency_key)
  VALUES (v_user_id, 'reservation', p_amount, p_operation, 'pending', p_idempotency_key)
  RETURNING credit_ledger.id INTO v_reservation_id;

  SELECT b.balance INTO v_balance FROM credit_balance() b;
  RETURN QUERY SELECT true, v_balance, v_reservation_id;
END;
$$;

-- 2. Execution requeue arms: the retry cron moves failed/rate_limited rows
-- to pending, which the trigger rejected (busy loop, background retry 100%
-- broken). Requeue is attempt-guarded in the cron; these arms make it legal.
CREATE OR REPLACE FUNCTION enforce_work_execution_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF OLD.status = 'pending' AND NEW.status IN ('running','canceled','needs_approval') THEN RETURN NEW; END IF;
  IF OLD.status = 'running' AND NEW.status IN ('succeeded','failed','canceled','needs_input','needs_approval','rate_limited') THEN RETURN NEW; END IF;
  IF OLD.status = 'needs_input' AND NEW.status IN ('running','failed','canceled') THEN RETURN NEW; END IF;
  IF OLD.status = 'needs_approval' AND NEW.status IN ('running','failed','canceled') THEN RETURN NEW; END IF;
  IF OLD.status = 'rate_limited' AND NEW.status IN ('running','failed','canceled','pending') THEN RETURN NEW; END IF;
  IF OLD.status = 'failed' AND NEW.status IN ('pending') THEN RETURN NEW; END IF;
  IF OLD.status IN ('succeeded','failed','canceled') AND false THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Illegal work_executions transition % -> %', OLD.status, NEW.status;
END;
$$;

-- 3. sign_as_owner v2: party binding + version advancement. Previously any
-- owned signer id (including counterparties) could be marked signed, and the
-- version never left draft (so every owner sign died on the owner-first
-- trigger, and counterparty signing could never unlock). Now: owner rows
-- only, version walks draft->ready_to_sign->owner_signed first (all legal
-- arms), then the signer flips (trigger sees owner_signed and passes).
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

-- 4. Completion trigger: when the last pending signer on a version flips to
-- signed, walk the version to fully_signed along legal arms
-- (owner_signed->counterparty_pending->fully_signed). Previously NOTHING
-- advanced versions, so Tracker (fully_signed/locked) stayed empty forever
-- and owner_signed versions could never complete. Idempotent: re-fires are
-- no-ops once fully_signed.
CREATE OR REPLACE FUNCTION advance_version_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM 'signed' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM document_signers s
    WHERE s.document_version_id = NEW.document_version_id AND s.status = 'pending'
  ) THEN
    RETURN NEW;
  END IF;
  SELECT status INTO v_status FROM document_versions WHERE id = NEW.document_version_id;
  IF v_status = 'owner_signed' THEN
    UPDATE document_versions SET status = 'counterparty_pending', updated_at = now() WHERE id = NEW.document_version_id;
    v_status := 'counterparty_pending';
  END IF;
  IF v_status IN ('counterparty_pending', 'sent') THEN
    UPDATE document_versions SET status = 'fully_signed', fully_signed_at = now(), updated_at = now() WHERE id = NEW.document_version_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_version_completion ON document_signers;
CREATE TRIGGER trg_version_completion
  AFTER UPDATE OF status ON document_signers
  FOR EACH ROW EXECUTE FUNCTION advance_version_on_completion();

-- 5. Explicit RPC execute grants (project convention; today these rely on the
-- PUBLIC default — one hardening migration revoking it would brick billing).
GRANT EXECUTE ON FUNCTION reserve_credits(TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_reservation(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION void_reservation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION credit_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION increment_usage(TEXT, INTEGER) TO authenticated;

-- 6. Deadline-reminder cron reads Gmail tokens through the service role:
-- grant least-privilege read (refresh itself stays user-scoped).
GRANT SELECT ON public.gmail_tokens TO service_role;

-- 7. One pending invite per version+email: makes double-submit a no-op at
-- the database level (verified zero existing duplicates before adding).
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_signer_per_version_email
  ON document_signers(document_version_id, lower(email))
  WHERE status = 'pending';
