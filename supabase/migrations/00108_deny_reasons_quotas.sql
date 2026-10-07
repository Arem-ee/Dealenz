-- 00108: deny reasons + per-member pool caps (phase 1: quotas).
--
-- reserve_credits gains a deny_reason column so callers can tell WHY a
-- hold failed (pool_empty vs cap_hit vs not_member vs insufficient)
-- instead of rendering one generic message. Reasons travel the existing
-- chain (RPC → ledger client → policy → UI) with no other signature
-- changes; old 3-arg callers keep working through defaults.
-- Caps live in member_quotas (owner/admin-written via RPC, rolling
-- 30-day window so packs-funded pools without billing periods work
-- identically). The cap check sits INSIDE reserve under the pool lock —
-- an app pre-check would race — and gates total consumption (allowance
-- AND overage): a capped member cannot burn metered debt the owner pays.
-- Solo rows never consult quotas.

CREATE TABLE IF NOT EXISTS member_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cap_credits INTEGER NOT NULL CHECK (cap_credits > 0),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_member_quotas_org ON member_quotas(org_id);

ALTER TABLE member_quotas ENABLE ROW LEVEL SECURITY;

-- Members read quotas of their own orgs; writes flow only through the
-- RPC below (owner/admin).
DROP POLICY IF EXISTS "Org members read quotas" ON member_quotas;
CREATE POLICY "Org members read quotas"
  ON member_quotas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = member_quotas.org_id AND m.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION set_member_quota(p_org_id UUID, p_user_id UUID, p_cap INTEGER)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acting_role TEXT;
BEGIN
  IF p_cap IS NULL OR p_cap <= 0 THEN
    RETURN QUERY SELECT false, 'Quota must be a positive credit amount';
    RETURN;
  END IF;
  SELECT role INTO v_acting_role FROM organization_members
  WHERE org_id = p_org_id AND user_id = auth.uid();
  IF NOT FOUND OR v_acting_role NOT IN ('owner', 'admin') THEN
    RETURN QUERY SELECT false, 'Only organization owners and admins can set quotas';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = p_org_id AND user_id = p_user_id
  ) THEN
    RETURN QUERY SELECT false, 'That account is not a member of this organization';
    RETURN;
  END IF;
  INSERT INTO member_quotas (org_id, user_id, cap_credits, updated_by)
  VALUES (p_org_id, p_user_id, p_cap, auth.uid())
  ON CONFLICT (org_id, user_id) DO UPDATE
  SET cap_credits = EXCLUDED.cap_credits, updated_by = auth.uid(), updated_at = now();
  RETURN QUERY SELECT true, 'Quota set';
END;
$$;

GRANT EXECUTE ON FUNCTION set_member_quota(UUID, UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION remove_member_quota(p_org_id UUID, p_user_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acting_role TEXT;
BEGIN
  SELECT role INTO v_acting_role FROM organization_members
  WHERE org_id = p_org_id AND user_id = auth.uid();
  IF NOT FOUND OR v_acting_role NOT IN ('owner', 'admin') THEN
    RETURN QUERY SELECT false, 'Only organization owners and admins can remove quotas';
    RETURN;
  END IF;
  DELETE FROM member_quotas WHERE org_id = p_org_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'No quota set for that member';
    RETURN;
  END IF;
  RETURN QUERY SELECT true, 'Quota removed';
END;
$$;

GRANT EXECUTE ON FUNCTION remove_member_quota(UUID, UUID) TO authenticated;

-- reserve_credits with deny reasons and the quota check. DROP first:
-- the fourth return column changes the type, which OR REPLACE forbids
-- (42P13). The grant below re-issues.
DROP FUNCTION IF EXISTS reserve_credits(TEXT, INTEGER, TEXT, UUID);
CREATE OR REPLACE FUNCTION reserve_credits(
  p_operation TEXT,
  p_amount INTEGER,
  p_idempotency_key TEXT,
  p_org_id UUID DEFAULT NULL
)
RETURNS TABLE(allowed BOOLEAN, balance INTEGER, reservation_id UUID, deny_reason TEXT)
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
  v_cap INTEGER;
  v_spent INTEGER := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 0, NULL::UUID, 'not_member'::TEXT;
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
      RETURN QUERY SELECT false, 0, NULL::UUID, 'not_member'::TEXT;
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
      RETURN QUERY SELECT true, v_balance, v_existing_id, NULL::TEXT;
      RETURN;
    END IF;
    IF v_existing_id IS NOT NULL THEN
      SELECT b.balance INTO v_balance FROM credit_balance(p_org_id) b;
      RETURN QUERY SELECT false, v_balance, NULL::UUID, 'insufficient'::TEXT;
      RETURN;
    END IF;

    SELECT b.balance INTO v_balance FROM credit_balance(p_org_id) b;

    -- Member quota: total consumption (allowance AND overage) in the
    -- trailing 30 days against the cap. Inside the pool lock, so
    -- concurrent reserves cannot both slip under. Checked before the
    -- floor so a capped member is told about their cap, not the pool.
    SELECT q.cap_credits INTO v_cap
    FROM member_quotas q
    WHERE q.org_id = p_org_id AND q.user_id = v_user_id;
    IF v_cap IS NOT NULL THEN
      SELECT COALESCE(SUM(t.amount), 0) INTO v_spent
      FROM credit_ledger t
      WHERE t.org_id = p_org_id
        AND t.user_id = v_user_id
        AND t.entry_type = 'consumption'
        AND t.status = 'finalized'
        AND t.created_at > now() - interval '30 days';
      IF v_spent + p_amount > v_cap THEN
        RETURN QUERY SELECT false, v_balance, NULL::UUID, 'cap_hit'::TEXT;
        RETURN;
      END IF;
    END IF;

    -- Org overage leg: opted-in live org plans meter to minus one full
    -- org allowance. Fail-closed to the hard cap otherwise (floor 0 ⟺
    -- the old balance check, verbatim).
    SELECT COALESCE(-s.monthly_allowance, 0) INTO v_overage_floor
    FROM org_subscriptions s
    WHERE s.org_id = p_org_id
      AND s.overage_allowed = true
      AND s.status IN ('active', 'trialing', 'past_due');
    v_overage_floor := COALESCE(v_overage_floor, 0);
    IF v_balance - v_overage_floor < p_amount THEN
      RETURN QUERY SELECT false, v_balance, NULL::UUID, 'pool_empty'::TEXT;
      RETURN;
    END IF;

    INSERT INTO credit_ledger (user_id, org_id, entry_type, amount, operation, status, idempotency_key)
    VALUES (v_user_id, p_org_id, 'reservation', p_amount, p_operation, 'pending', p_idempotency_key)
    RETURNING credit_ledger.id INTO v_reservation_id;

    SELECT b.balance INTO v_balance FROM credit_balance(p_org_id) b;
    RETURN QUERY SELECT true, v_balance, v_reservation_id, NULL::TEXT;
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
    RETURN QUERY SELECT true, v_balance, v_existing_id, NULL::TEXT;
    RETURN;
  END IF;
  IF v_existing_id IS NOT NULL THEN
    SELECT b.balance INTO v_balance FROM credit_balance() b;
    RETURN QUERY SELECT false, v_balance, NULL::UUID, 'insufficient'::TEXT;
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
    RETURN QUERY SELECT false, v_balance, NULL::UUID, 'insufficient'::TEXT;
    RETURN;
  END IF;

  INSERT INTO credit_ledger (user_id, entry_type, amount, operation, status, idempotency_key)
  VALUES (v_user_id, 'reservation', p_amount, p_operation, 'pending', p_idempotency_key)
  RETURNING credit_ledger.id INTO v_reservation_id;

  SELECT b.balance INTO v_balance FROM credit_balance() b;
  RETURN QUERY SELECT true, v_balance, v_reservation_id, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_credits(TEXT, INTEGER, TEXT, UUID) TO authenticated;
