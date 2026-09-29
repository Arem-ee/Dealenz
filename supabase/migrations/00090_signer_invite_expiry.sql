-- 00090: signature-invitation expiry.
--
-- Invitations can carry an optional expiry timestamp. Enforcement is a
-- row-level guard, not per-function logic, so every signing path (invitee
-- RPC, owner RPC, legacy RPCs, direct owner UPDATE) honors it identically:
-- a pending invitation whose expiry has passed can never flip to signed.
-- A scheduled pass flips lapsed pending rows to 'expired' so queues read
-- honestly. Forward-only, additive: nullable column (existing rows never
-- expire, exactly as before), a widened status check keeping every
-- previously valid value, and one narrow trigger. No RLS change: owners
-- still cannot write signer rows directly except through the existing
-- owner-update policy, which the trigger constrains the same way.

ALTER TABLE document_signers
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

ALTER TABLE document_signers
  DROP CONSTRAINT IF EXISTS document_signers_status_check;

ALTER TABLE document_signers
  ADD CONSTRAINT document_signers_status_check
  CHECK (status IN ('pending', 'signed', 'declined', 'revoked', 'expired'));

CREATE INDEX IF NOT EXISTS idx_document_signers_expires
  ON document_signers (expires_at) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION reject_expired_signing()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'signed'
     AND OLD.expires_at IS NOT NULL AND OLD.expires_at <= now() THEN
    RAISE EXCEPTION 'This signing invitation has expired';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_expired_signing ON document_signers;

CREATE TRIGGER trg_reject_expired_signing
  BEFORE UPDATE OF status ON document_signers
  FOR EACH ROW
  EXECUTE FUNCTION reject_expired_signing();
