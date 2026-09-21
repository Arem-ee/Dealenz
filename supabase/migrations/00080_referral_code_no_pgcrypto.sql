-- 00080: referral codes without pgcrypto.
--
-- ensure_referral_code() (00033) generated codes with gen_random_bytes(),
-- a pgcrypto function. pgcrypto was never enabled on the project, so every
-- first-time call failed with "function gen_random_bytes(integer) does not
-- exist" and the raw Postgres error leaked into the billing UI.
--
-- Forward-only, additive. 00033 untouched. Two layers:
--   1. Enable pgcrypto if missing (belt: the function name now resolves
--      anywhere else it is ever referenced).
--   2. Redefine ensure_referral_code() to derive codes from
--      gen_random_uuid() — built into Postgres 13+, no extension needed
--      (suspenders: this RPC can never hit the missing-function path again).
-- Code shape is unchanged: 8 uppercase alphanumerics, same CHECK
-- constraint, same advisory-lock + 5-retry collision loop, same grants.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
    -- gen_random_uuid() needs no extension. Strip dashes, take 8 hex chars,
    -- uppercase: matches referral_codes.code CHECK (^[A-Z0-9]{8}$).
    v_code := upper(substr(translate(gen_random_uuid()::text, '-', ''), 1, 8));
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
