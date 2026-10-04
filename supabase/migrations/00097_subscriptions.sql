-- 00097: subscriptions for the allowance model (phase 1: solo scope).
--
-- Packs (credit_purchases) stay exactly as they are. This table adds the
-- recurring leg: one live subscription per user (partial unique), the
-- Paddle subscription id, the plan, the billing period, and the cap
-- switch. Allowance credits themselves ride the existing ledger as
-- grants with metadata reason 'allowance' and idempotency
-- 'allowance:<subscription_id>:<period_start>' — no ledger change.
-- Use-or-lose expiry is an 'adjustment' clawing back the unspent slice
-- of that period's grant; pack credits are never touched because the
-- clawback is capped at granted-minus-consumed for the period.
-- overage_allowed is carried for phase 2 (metered overage billing);
-- phase 1 enforces the hard cap everywhere via the existing
-- reserve_credits deny, and the UI states that plainly.

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (char_length(plan_id) BETWEEN 1 AND 60),
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'paused', 'canceled')) DEFAULT 'active',
  paddle_subscription_id TEXT UNIQUE,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'GBP', 'EUR')) DEFAULT 'USD',
  monthly_allowance INT NOT NULL CHECK (monthly_allowance > 0),
  overage_allowed BOOLEAN NOT NULL DEFAULT false,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_live_user
  ON subscriptions (user_id) WHERE status IN ('active', 'trialing', 'past_due', 'paused');

CREATE INDEX IF NOT EXISTS idx_subscriptions_period
  ON subscriptions (status, current_period_end) WHERE status IN ('active', 'trialing', 'past_due', 'paused');

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own subscriptions" ON subscriptions;
CREATE POLICY "Users read own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- No user INSERT/UPDATE/DELETE: subscription rows are written by the
-- Paddle webhook and the allowance cron through the service role, never
-- by client sessions. The cap switch flips in phase 2 through its own
-- gated action.
