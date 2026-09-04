-- Phase 5E: user credit ledger.
--
-- Append-mostly ledger. Grants, refunds, and positive adjustments add signed
-- credits; consumptions and open reservations subtract. Reservations move
-- pending to finalized (consumption recorded) or voided (failure, hold
-- released) only inside the RPCs below; rows are never deleted and voided
-- rows stay readable for audit. Available balance is always derived, never
-- stored, so concurrent writers cannot leave it inconsistent: every
-- balance-changing RPC takes a per-user advisory transaction lock first.
--
-- RLS: users read their own rows. There are deliberately NO public
-- INSERT/UPDATE/DELETE policies: all writes go through the SECURITY DEFINER
-- RPCs (same convention as increment_usage). No payment processing, no
-- checkout, no webhooks in this phase; grants arrive via the admin RPC until
-- a payment provider exists.

CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('grant', 'reservation', 'consumption', 'refund', 'adjustment')),
  amount INTEGER NOT NULL CHECK (amount <> 0),
  operation TEXT,
  status TEXT NOT NULL DEFAULT 'finalized' CHECK (status IN ('pending', 'finalized', 'voided')),
  idempotency_key TEXT CHECK (idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 1 AND 120),
  related_entry_id UUID REFERENCES credit_ledger(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credit_ledger_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX idx_credit_ledger_user ON credit_ledger(user_id);
CREATE INDEX idx_credit_ledger_user_created ON credit_ledger(user_id, created_at DESC);

ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

-- Users read their own ledger history (balances and consumption visibility).
CREATE POLICY "Users can view own ledger"
  ON credit_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- No public INSERT/UPDATE/DELETE policies by design. All writes below.

-- Available balance for the caller. Voided rows never count; open
-- reservations count as holds.
CREATE OR REPLACE FUNCTION credit_balance()
RETURNS TABLE(balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_balance INTEGER := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;
  SELECT COALESCE(SUM(
    CASE
      WHEN t.status = 'voided' THEN 0
      WHEN t.entry_type IN ('grant', 'refund') THEN t.amount
      WHEN t.entry_type = 'adjustment' THEN t.amount
      WHEN t.entry_type = 'consumption' THEN -t.amount
      WHEN t.entry_type = 'reservation' AND t.status = 'pending' THEN -t.amount
      ELSE 0
    END
  ), 0) INTO v_balance
  FROM credit_ledger t
  WHERE t.user_id = v_user_id;
  RETURN QUERY SELECT v_balance;
END;
$$;

-- Holds amount credits for one billable operation. Idempotent on
-- (user, idempotency_key): replays return the original outcome without a new
-- hold. Denies when the available balance is insufficient. Per-user advisory
-- lock serializes concurrent reservations.
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

  IF v_existing_id IS NOT NULL THEN
    SELECT b.balance INTO v_balance FROM credit_balance() b;
    RETURN QUERY SELECT true, v_balance, v_existing_id;
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

-- Settles a pending reservation: voids the hold, then records measured
-- consumption (which may be lower than reserved, or NULL for metered-only
-- usage with no charge). Ownership and pending state are re-checked.
CREATE OR REPLACE FUNCTION finalize_reservation(
  p_reservation_id UUID,
  p_consumption_amount INTEGER,
  p_operation TEXT
)
RETURNS TABLE(balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_balance INTEGER := 0;
  v_owner UUID;
  v_status TEXT;
  v_key TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_consumption_amount IS NOT NULL AND p_consumption_amount < 0 THEN
    RAISE EXCEPTION 'Consumption amount must be non-negative or null';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:' || v_user_id::text));

  SELECT t.user_id, t.status, t.idempotency_key INTO v_owner, v_status, v_key
  FROM credit_ledger t
  WHERE t.id = p_reservation_id AND t.entry_type = 'reservation';

  IF v_owner IS NULL OR v_owner <> v_user_id THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Reservation is no longer pending';
  END IF;

  UPDATE credit_ledger SET status = 'voided' WHERE id = p_reservation_id;

  IF p_consumption_amount IS NOT NULL AND p_consumption_amount > 0 THEN
    INSERT INTO credit_ledger (user_id, entry_type, amount, operation, status, related_entry_id)
    VALUES (v_user_id, 'consumption', p_consumption_amount, p_operation, 'finalized', p_reservation_id);
  END IF;

  SELECT b.balance INTO v_balance FROM credit_balance() b;
  RETURN QUERY SELECT v_balance;
END;
$$;

-- Releases a pending hold after a failed operation. No charge is recorded.
CREATE OR REPLACE FUNCTION void_reservation(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:' || v_user_id::text));

  UPDATE credit_ledger SET status = 'voided'
  WHERE id = p_reservation_id
    AND entry_type = 'reservation'
    AND status = 'pending'
    AND user_id = v_user_id;
END;
$$;

-- Admin-only credit grant (signup bonuses, compensation, ops). Positive only.
CREATE OR REPLACE FUNCTION grant_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT
)
RETURNS TABLE(balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := false;
  v_balance INTEGER := 0;
BEGIN
  SELECT (auth.users.raw_user_meta_data->>'is_admin')::boolean INTO v_is_admin
  FROM auth.users WHERE auth.users.id = auth.uid();
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Grant amount must be positive';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:' || p_user_id::text));

  INSERT INTO credit_ledger (user_id, entry_type, amount, operation, status, metadata)
  VALUES (p_user_id, 'grant', p_amount, NULL, 'finalized', jsonb_build_object('reason', p_reason));

  SELECT COALESCE(SUM(
    CASE
      WHEN t.status = 'voided' THEN 0
      WHEN t.entry_type IN ('grant', 'refund') THEN t.amount
      WHEN t.entry_type = 'adjustment' THEN t.amount
      WHEN t.entry_type = 'consumption' THEN -t.amount
      WHEN t.entry_type = 'reservation' AND t.status = 'pending' THEN -t.amount
      ELSE 0
    END
  ), 0) INTO v_balance
  FROM credit_ledger t
  WHERE t.user_id = p_user_id;
  RETURN QUERY SELECT v_balance;
END;
$$;
