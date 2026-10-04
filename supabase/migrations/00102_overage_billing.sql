-- 00102: metered overage (phase 1: solo accounts).
--
-- The hard cap (`reserve_credits` denies below balance) becomes a meter
-- when the subscription opts in: reservations may drive the balance down
-- to minus one full allowance (bounded liability, stated in the UI).
-- Overage is computed at invoice time from aggregates — period
-- consumption minus period allowance grants minus starting positive
-- balance — so no per-row tagging and no finalize changes. The starting
-- balance snapshots onto the subscription at activation and rollover.
-- Settlement is one Paddle one-time charge per period invoice; the
-- webhook maps it back through custom_data and marks paid WITHOUT
-- granting credits (the work already ran).

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS period_start_balance INTEGER NOT NULL DEFAULT 0;

-- One-time backfill for live subscriptions predating snapshots: current
-- balance, computed with the live credit_balance() CASE. Taken mid-period
-- it overstates the true window start, which only ever UNDER-counts the
-- first overage — safe direction (users never overcharged); the next
-- rollover snapshots exactly.
UPDATE subscriptions s
SET period_start_balance = GREATEST(0, (
  SELECT COALESCE(SUM(
    CASE
      WHEN t.status = 'voided' THEN 0
      WHEN t.entry_type IN ('grant', 'refund') THEN t.amount
      WHEN t.entry_type = 'adjustment' THEN t.amount
      WHEN t.entry_type = 'consumption' THEN -t.amount
      WHEN t.entry_type = 'reservation' AND t.status = 'pending'
        AND t.created_at > now() - interval '1 hour' THEN -t.amount
      ELSE 0
    END
  ), 0)
  FROM credit_ledger t
  WHERE t.user_id = s.user_id
))
WHERE s.status IN ('active', 'trialing', 'past_due');

CREATE TABLE IF NOT EXISTS overage_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  overage_credits INTEGER NOT NULL CHECK (overage_credits > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor > 0),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'GBP', 'EUR')),
  paddle_transaction_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'invoiced', 'paid', 'failed', 'voided')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_overage_invoices_user
  ON overage_invoices (user_id, status, created_at DESC);

ALTER TABLE overage_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own overage invoices" ON overage_invoices;
CREATE POLICY "Users read own overage invoices"
  ON overage_invoices FOR SELECT
  USING (auth.uid() = user_id);

-- No user INSERT/UPDATE/DELETE: invoices are written by the invoicing
-- pass and the webhook through the service role.

-- reserve_credits with the overage leg (otherwise identical to the 00088
-- revision: same replay rules, same lock, same grants). When the caller
-- holds a live subscription with overage_allowed, the floor drops to
-- minus one full allowance: deny iff balance - allowance < amount.
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
  v_overage_floor INTEGER := 0;
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
  -- Overage leg: opted-in live subscriptions meter to minus one full
  -- allowance. The flag lives on the subscription (flipped only by an
  -- explicit user action); the headroom equals that row's allowance.
  SELECT COALESCE(-s.monthly_allowance, 0) INTO v_overage_floor
  FROM subscriptions s
  WHERE s.user_id = v_user_id
    AND s.overage_allowed = true
    AND s.status IN ('active', 'trialing', 'past_due');
  -- No subscription row leaves the target NULL: fail closed to the hard
  -- cap, never open.
  v_overage_floor := COALESCE(v_overage_floor, 0);
  -- Single deny rule: floor 0 ⟺ the old balance check, verbatim.
  IF v_balance - v_overage_floor < p_amount THEN
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
