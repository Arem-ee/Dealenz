-- Phase 22: referral MVP (Sub-phase C).
--
-- Forward-only, additive. No historical migration touched.
-- Two tables plus three narrow RPCs. All writes go through the RPCs;
-- there are deliberately NO public INSERT/UPDATE/DELETE policies
-- (same convention as credit_ledger in 00023).
--
-- Reward amount is a fixed server-side constant below (PROVISIONAL —
-- requires product sign-off before production activation; see
-- src/lib/referrals/policy.ts REFERRAL_REWARD_CREDITS which must match).

CREATE TABLE referral_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{8}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE referral_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  CONSTRAINT no_self_referral CHECK (referrer_user_id <> referred_user_id)
);

CREATE INDEX idx_referral_codes_code ON referral_codes(code);
CREATE INDEX idx_referral_attributions_referrer ON referral_attributions(referrer_user_id);
CREATE INDEX idx_referral_attributions_status ON referral_attributions(status);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_attributions ENABLE ROW LEVEL SECURITY;

-- A user reads their own code. No anonymous reads.
CREATE POLICY "Users can view own referral code"
  ON referral_codes FOR SELECT
  USING (auth.uid() = user_id);

-- Both parties read attributions they participate in. No anonymous reads.
CREATE POLICY "Referral parties can view own attributions"
  ON referral_attributions FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- No public INSERT/UPDATE/DELETE policies by design. All writes below.

-- Returns the caller's code, creating one if absent. Code is server-
-- generated (8 uppercase alphanumerics); the client never chooses it.
CREATE OR REPLACE FUNCTION ensure_referral_code()
RETURNS TABLE(code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_code TEXT;
  v_existing TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('referral_code:' || v_user_id::text));

  SELECT t.code INTO v_existing FROM referral_codes t WHERE t.user_id = v_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing;
    RETURN;
  END IF;

  FOR i IN 1..5 LOOP
    v_code := upper(substr(encode(gen_random_bytes(6), 'base64'), 1, 8));
    v_code := translate(v_code, '+/=', 'XYZ');
    BEGIN
      INSERT INTO referral_codes (user_id, code) VALUES (v_user_id, v_code);
      RETURN QUERY SELECT v_code;
      RETURN;
    EXCEPTION WHEN unique_violation THEN
      -- Collision: retry with a fresh code.
    END;
  END LOOP;
  RAISE EXCEPTION 'Could not generate a referral code';
END;
$$;

-- Attributes the caller to the owner of p_code. Idempotent per referred
-- user: replaying returns the existing attribution without a second row.
CREATE OR REPLACE FUNCTION attribute_referral(p_code TEXT)
RETURNS TABLE(attributed BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_referrer_id UUID;
  v_code TEXT;
  v_existing_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'not_authenticated'::TEXT;
    RETURN;
  END IF;

  v_code := upper(trim(COALESCE(p_code, '')));
  IF v_code !~ '^[A-Z0-9]{8}$' THEN
    RETURN QUERY SELECT false, 'invalid_code'::TEXT;
    RETURN;
  END IF;

  SELECT t.user_id INTO v_referrer_id FROM referral_codes t WHERE t.code = v_code;
  IF v_referrer_id IS NULL THEN
    RETURN QUERY SELECT false, 'unknown_code'::TEXT;
    RETURN;
  END IF;
  IF v_referrer_id = v_user_id THEN
    RETURN QUERY SELECT false, 'self_referral'::TEXT;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('referral_attr:' || v_user_id::text));

  SELECT t.id INTO v_existing_id FROM referral_attributions t WHERE t.referred_user_id = v_user_id;
  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT false, 'already_attributed'::TEXT;
    RETURN;
  END IF;

  INSERT INTO referral_attributions (referrer_user_id, referred_user_id, code, status)
  VALUES (v_referrer_id, v_user_id, v_code, 'pending');
  RETURN QUERY SELECT true, 'attributed'::TEXT;
END;
$$;

-- Rewards the referrer once when the caller completes qualifying work.
-- Must be called after a successful analyzeDeal. Atomic: pending →
-- rewarded plus a credit_ledger grant to the referrer in one transaction.
-- Replay-safe: an already-rewarded attribution returns without a second
-- grant (the ledger UNIQUE(user_id, idempotency_key) is the final guard).
-- PROVISIONAL reward amount: requires product sign-off before production
-- activation. Keep in sync with REFERRAL_REWARD_CREDITS in
-- src/lib/referrals/policy.ts.
CREATE OR REPLACE FUNCTION claim_referral_reward()
RETURNS TABLE(rewarded BOOLEAN, amount INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_attr_id UUID;
  v_referrer_id UUID;
  v_status TEXT;
  v_amount INTEGER := 5;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('referral_attr:' || v_user_id::text));

  SELECT t.id, t.referrer_user_id, t.status INTO v_attr_id, v_referrer_id, v_status
  FROM referral_attributions t
  WHERE t.referred_user_id = v_user_id
  FOR UPDATE;

  IF v_attr_id IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  IF v_status = 'rewarded' THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('credit_ledger:' || v_referrer_id::text));

  UPDATE referral_attributions
  SET status = 'rewarded', qualified_at = COALESCE(qualified_at, now()), rewarded_at = now()
  WHERE id = v_attr_id;

  INSERT INTO credit_ledger (user_id, entry_type, amount, operation, status, idempotency_key, metadata)
  VALUES (v_referrer_id, 'grant', v_amount, NULL, 'finalized', 'referral:' || v_attr_id::text,
          jsonb_build_object('reason', 'referral_reward', 'attribution_id', v_attr_id::text))
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  RETURN QUERY SELECT true, v_amount;
END;
$$;
