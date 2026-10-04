-- 00103: shared org pools (phase 1: packs-funded, pool-first).
--
-- A nullable org_id scopes ledger rows to a pool; solo rows (org_id NULL)
-- behave exactly as before. Pool rows carry BOTH user_id (the acting
-- member, for attribution) and org_id (the balance scope). Spend
-- priority is pool-first by construction (the policy layer tries the
-- active scope first); personal balances freeze untouched on pool join —
-- no merge, no sweep. Phase 1 funds pools with packs only: no org
-- allowance, no org overage (the reserve leg hard-caps pools at zero).
-- Idempotency splits by scope (NULL keys never conflict), locks move to
-- the balance scope under a new key namespace, and every mutated RPC
-- keeps working with old signatures via DEFAULT NULL.

ALTER TABLE credit_ledger
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE credit_ledger
  DROP CONSTRAINT IF EXISTS credit_ledger_user_id_idempotency_key_key;

DROP INDEX IF EXISTS uq_ledger_solo_idempotency;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_solo_idempotency
  ON credit_ledger (user_id, idempotency_key) WHERE org_id IS NULL;

DROP INDEX IF EXISTS uq_ledger_org_idempotency;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_org_idempotency
  ON credit_ledger (org_id, idempotency_key) WHERE org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_org_created
  ON credit_ledger (org_id, created_at DESC) WHERE org_id IS NOT NULL;

ALTER TABLE credit_purchases
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

-- Pool reads for members; solo reads unchanged. No direct writes (RPC-only).
DROP POLICY IF EXISTS "Pool members read pool ledger" ON credit_ledger;
CREATE POLICY "Pool members read pool ledger"
  ON credit_ledger FOR SELECT
  USING (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = credit_ledger.org_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Pool members read pool purchases" ON credit_purchases;
CREATE POLICY "Pool members read pool purchases"
  ON credit_purchases FOR SELECT
  USING (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = credit_purchases.org_id AND m.user_id = auth.uid()
    )
  );

-- Active billing scope: solo (NULL) or one org. Read by the spend policy
-- to pick the balance; written only by the explicit switch action.
CREATE TABLE IF NOT EXISTS user_billing_scope (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_billing_scope ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own billing scope" ON user_billing_scope;
CREATE POLICY "Users manage own billing scope"
  ON user_billing_scope FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Balance with an explicit scope. NULL org_id is the legacy query,
-- verbatim. Org scope requires membership and sums org rows only.
-- DROP first: a second overload would make PostgREST calls ambiguous
-- (both signatures match 0-arg calls). The default keeps old callers
-- working untouched.
DROP FUNCTION IF EXISTS credit_balance();
CREATE OR REPLACE FUNCTION credit_balance(p_org_id UUID DEFAULT NULL)
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
  IF p_org_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = p_org_id AND user_id = v_user_id
  ) THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;
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
  ), 0) INTO v_balance
  FROM credit_ledger t
  WHERE (p_org_id IS NULL AND t.user_id = v_user_id AND t.org_id IS NULL)
     OR (p_org_id IS NOT NULL AND t.org_id = p_org_id);
  RETURN QUERY SELECT v_balance;
END;
$$;

-- reserve_credits with the org leg (otherwise identical to the 00102
-- revision: same replay rules, same overage leg for solo rows). Org
-- scope: member check, pool lock, org-grain idempotency, pool balance,
-- hard cap at zero (no org overage in phase 1). DROP first for the same
-- PostgREST ambiguity reason; the default keeps 3-arg callers working.
DROP FUNCTION IF EXISTS reserve_credits(TEXT, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION reserve_credits(
  p_operation TEXT,
  p_amount INTEGER,
  p_idempotency_key TEXT,
  p_org_id UUID DEFAULT NULL
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

  IF p_org_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = p_org_id AND user_id = v_user_id
    ) THEN
      RETURN QUERY SELECT false, 0, NULL::UUID;
      RETURN;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('credit_pool:' || p_org_id::text));

    SELECT t.id, t.status INTO v_existing_id, v_existing_status
    FROM credit_ledger t
    WHERE t.org_id = p_org_id AND t.idempotency_key = p_idempotency_key
    ORDER BY t.created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL AND v_existing_status = 'pending' THEN
      SELECT b.balance INTO v_balance FROM credit_balance(p_org_id) b;
      RETURN QUERY SELECT true, v_balance, v_existing_id;
      RETURN;
    END IF;
    IF v_existing_id IS NOT NULL THEN
      SELECT b.balance INTO v_balance FROM credit_balance(p_org_id) b;
      RETURN QUERY SELECT false, v_balance, NULL::UUID;
      RETURN;
    END IF;

    SELECT b.balance INTO v_balance FROM credit_balance(p_org_id) b;
    IF v_balance < p_amount THEN
      RETURN QUERY SELECT false, v_balance, NULL::UUID;
      RETURN;
    END IF;

    INSERT INTO credit_ledger (user_id, org_id, entry_type, amount, operation, status, idempotency_key)
    VALUES (v_user_id, p_org_id, 'reservation', p_amount, p_operation, 'pending', p_idempotency_key)
    RETURNING credit_ledger.id INTO v_reservation_id;

    SELECT b.balance INTO v_balance FROM credit_balance(p_org_id) b;
    RETURN QUERY SELECT true, v_balance, v_reservation_id;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:' || v_user_id::text));

  SELECT t.id, t.status INTO v_existing_id, v_existing_status
  FROM credit_ledger t
  WHERE t.user_id = v_user_id AND t.org_id IS NULL AND t.idempotency_key = p_idempotency_key
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

-- finalize_reservation: scope derives from the reservation row (no scope
-- param to smuggle). Org rows require live membership and the pool lock;
-- the consumption row inherits the scope.
CREATE OR REPLACE FUNCTION finalize_reservation(p_reservation_id UUID, p_consumption_amount INTEGER, p_operation TEXT)
RETURNS TABLE(balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_balance INTEGER := 0;
  v_owner UUID;
  v_org_id UUID;
  v_status TEXT;
  v_key TEXT;
  v_reserved INTEGER := 0;
  v_charge INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_consumption_amount IS NOT NULL AND p_consumption_amount < 0 THEN
    RAISE EXCEPTION 'Consumption amount must be non-negative or null';
  END IF;

  SELECT t.user_id, t.org_id, t.status, t.idempotency_key, t.amount
    INTO v_owner, v_org_id, v_status, v_key, v_reserved
  FROM credit_ledger t
  WHERE t.id = p_reservation_id AND t.entry_type = 'reservation';

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  IF v_org_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = v_org_id AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Reservation not found';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('credit_pool:' || v_org_id::text));
  ELSE
    IF v_owner <> v_user_id THEN
      RAISE EXCEPTION 'Reservation not found';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:' || v_user_id::text));
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Reservation is no longer pending';
  END IF;

  UPDATE credit_ledger SET status = 'voided' WHERE id = p_reservation_id;

  v_charge := LEAST(COALESCE(p_consumption_amount, 0), GREATEST(v_reserved, 0));
  IF v_charge > 0 THEN
    INSERT INTO credit_ledger (user_id, org_id, entry_type, amount, operation, status, related_entry_id)
    VALUES (v_user_id, v_org_id, 'consumption', v_charge, p_operation, 'finalized', p_reservation_id);
  END IF;

  IF v_org_id IS NOT NULL THEN
    SELECT b.balance INTO v_balance FROM credit_balance(v_org_id) b;
  ELSE
    SELECT b.balance INTO v_balance FROM credit_balance() b;
  END IF;
  RETURN QUERY SELECT v_balance;
END;
$$;

-- void_reservation: same scope derivation.
CREATE OR REPLACE FUNCTION void_reservation(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT t.org_id INTO v_org_id
  FROM credit_ledger t
  WHERE t.id = p_reservation_id AND t.entry_type = 'reservation';

  IF v_org_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = v_org_id AND user_id = v_user_id
    ) THEN
      RETURN;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('credit_pool:' || v_org_id::text));
    UPDATE credit_ledger SET status = 'voided'
    WHERE id = p_reservation_id
      AND entry_type = 'reservation'
      AND status = 'pending'
      AND org_id = v_org_id;
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:' || v_user_id::text));
    UPDATE credit_ledger SET status = 'voided'
    WHERE id = p_reservation_id
      AND entry_type = 'reservation'
      AND status = 'pending'
      AND user_id = v_user_id
      AND org_id IS NULL;
  END IF;
END;
$$;

-- consume_reservation_step: scope from the row; step idempotency keyed by
-- reservation id (scope-inherent, no grain change needed).
CREATE OR REPLACE FUNCTION consume_reservation_step(
  p_reservation_id UUID,
  p_step_key TEXT,
  p_amount INTEGER
)
RETURNS TABLE(consumed_total INTEGER, remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_owner UUID;
  v_org_id UUID;
  v_status TEXT;
  v_reserved INTEGER;
  v_operation TEXT;
  v_used INTEGER := 0;
  v_key TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Step amount must be non-negative';
  END IF;
  IF p_step_key IS NULL OR char_length(p_step_key) = 0 OR char_length(p_step_key) > 78 THEN
    RAISE EXCEPTION 'Step key required (max 78 chars)';
  END IF;

  SELECT t.user_id, t.org_id, t.status, t.amount, t.operation
    INTO v_owner, v_org_id, v_status, v_reserved, v_operation
  FROM credit_ledger t
  WHERE t.id = p_reservation_id AND t.entry_type = 'reservation';

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  IF v_org_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = v_org_id AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Reservation not found';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('credit_pool:' || v_org_id::text));
  ELSE
    IF v_owner <> v_user_id THEN
      RAISE EXCEPTION 'Reservation not found';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:' || v_user_id::text));
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Reservation is no longer pending';
  END IF;

  v_key := 'step:' || p_reservation_id::text || ':' || p_step_key;

  -- Idempotent replay: this step already settled.
  IF EXISTS (
    SELECT 1 FROM credit_ledger
    WHERE org_id IS NOT DISTINCT FROM v_org_id AND idempotency_key = v_key
  ) THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_used
    FROM credit_ledger
    WHERE related_entry_id = p_reservation_id
      AND entry_type = 'consumption'
      AND status = 'finalized';
    RETURN QUERY SELECT v_used, GREATEST(v_reserved - v_used, 0);
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_used
  FROM credit_ledger
  WHERE related_entry_id = p_reservation_id
    AND entry_type = 'consumption'
    AND status = 'finalized';

  IF v_used + p_amount > v_reserved THEN
    RAISE EXCEPTION 'Step consumption exceeds reservation';
  END IF;

  IF p_amount > 0 THEN
    INSERT INTO credit_ledger (user_id, org_id, entry_type, amount, operation, status, related_entry_id, idempotency_key, metadata)
    VALUES (v_user_id, v_org_id, 'consumption', p_amount, v_operation, 'finalized', p_reservation_id, v_key, jsonb_build_object('step_key', p_step_key));
  END IF;

  RETURN QUERY SELECT v_used + p_amount, GREATEST(v_reserved - (v_used + p_amount), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION credit_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_credits(TEXT, INTEGER, TEXT, UUID) TO authenticated;
