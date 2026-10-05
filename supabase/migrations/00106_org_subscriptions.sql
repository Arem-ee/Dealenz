-- 00106: org subscriptions + org overage invoices (pools phase 2).
--
-- Separate tables beside the solo ones — zero solo queries change. One
-- live org plan per org (partial unique); the payer is the owner recorded
-- on the row. Threshold alerts (80/100% of allowance) ride alerts_sent
-- keyed by period start so each crossing notifies once. The reserve leg
-- below mirrors the solo overage leg: opted-in live org plans meter to
-- minus one full allowance, fail-closed to the hard cap otherwise.

CREATE TABLE IF NOT EXISTS org_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (char_length(plan_id) BETWEEN 1 AND 60),
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'paused', 'canceled')) DEFAULT 'active',
  paddle_subscription_id TEXT UNIQUE,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'GBP', 'EUR')) DEFAULT 'USD',
  monthly_allowance INT NOT NULL CHECK (monthly_allowance > 0),
  overage_allowed BOOLEAN NOT NULL DEFAULT false,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  period_start_balance INTEGER NOT NULL DEFAULT 0,
  alerts_sent JSONB NOT NULL DEFAULT '{}',
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_sub_live_org
  ON org_subscriptions (org_id) WHERE status IN ('active', 'trialing', 'past_due', 'paused');

CREATE INDEX IF NOT EXISTS idx_org_sub_period
  ON org_subscriptions (status, current_period_end) WHERE status IN ('active', 'trialing', 'past_due');

ALTER TABLE org_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members read org subscription" ON org_subscriptions;
CREATE POLICY "Org members read org subscription"
  ON org_subscriptions FOR SELECT
  USING (
    auth.uid() = owner_user_id
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = org_subscriptions.org_id AND m.user_id = auth.uid()
    )
  );

-- No user INSERT/UPDATE/DELETE: rows are written by the webhook and the
-- allowance cron through the service role, like solo subscriptions.

CREATE TABLE IF NOT EXISTS org_overage_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  org_subscription_id UUID NOT NULL REFERENCES org_subscriptions(id) ON DELETE CASCADE,
  payer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  overage_credits INTEGER NOT NULL CHECK (overage_credits > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor > 0),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'GBP', 'EUR')),
  paddle_transaction_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'invoiced', 'paid', 'failed', 'voided')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_subscription_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_org_overage_invoices_org
  ON org_overage_invoices (org_id, status, created_at DESC);

ALTER TABLE org_overage_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members read org invoices" ON org_overage_invoices;
CREATE POLICY "Org members read org invoices"
  ON org_overage_invoices FOR SELECT
  USING (
    auth.uid() = payer_user_id
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = org_overage_invoices.org_id AND m.user_id = auth.uid()
    )
  );

-- reserve_credits with the org-overage leg: same single-deny shape, the
-- floor consults the org plan when the reservation is pool-scoped. Solo
-- behavior is untouched (the 00102 leg still governs org_id IS NULL).
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
    -- Org overage leg: opted-in live org plans meter to minus one full
    -- org allowance. Fail-closed to the hard cap otherwise.
    SELECT COALESCE(-s.monthly_allowance, 0) INTO v_overage_floor
    FROM org_subscriptions s
    WHERE s.org_id = p_org_id
      AND s.overage_allowed = true
      AND s.status IN ('active', 'trialing', 'past_due');
    v_overage_floor := COALESCE(v_overage_floor, 0);
    IF v_balance - v_overage_floor < p_amount THEN
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

GRANT EXECUTE ON FUNCTION reserve_credits(TEXT, INTEGER, TEXT, UUID) TO authenticated;
