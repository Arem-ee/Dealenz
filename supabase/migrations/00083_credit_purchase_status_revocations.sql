-- Credit purchase revocation statuses (refunds + disputes).
--
-- The webhook revocation path stamps purchases "refunded", but the 00037
-- CHECK only allowed pending/succeeded/failed/canceled — the stamp failed
-- silently while the ledger revocation succeeded. Widen the constraint to
-- include the two terminal revocation states so status reflects reality.
-- Disputed purchases revoke through the same idempotent ledger path as
-- refunds (one revocation per transaction, never double).
--
-- Forward-only. Safe re-run (DROP IF EXISTS guards).

ALTER TABLE credit_purchases DROP CONSTRAINT IF EXISTS credit_purchases_status_check;
ALTER TABLE credit_purchases
  ADD CONSTRAINT credit_purchases_status_check
  CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled', 'refunded', 'disputed'));
