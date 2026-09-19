-- Free-signup credit grant: every new account starts with SIGNUP_GRANT_CREDITS.
--
-- Gated product actions (upload 15, signature-send 25, lawyer-request 15)
-- are deliberately priced above this grant, so never-purchased accounts
-- cannot afford them while still being able to try metered Ask work — purely
-- through the same balance check, with no plan flags or subscription state.
-- Fires once per auth user (idempotent on signup:<user_id>); deleting the
-- user cascades the grant row away via the existing foreign key.
--
-- Forward-only. Safe re-run (OR REPLACE / IF NOT EXISTS / DROP IF EXISTS).

CREATE OR REPLACE FUNCTION grant_signup_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO credit_ledger (user_id, entry_type, amount, operation, status, idempotency_key, metadata)
  VALUES (
    NEW.id,
    'grant',
    10,
    NULL,
    'finalized',
    'signup:' || NEW.id::text,
    jsonb_build_object('reason', 'signup')
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_signup_credits ON auth.users;
CREATE TRIGGER trg_grant_signup_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION grant_signup_credits();
