-- Phase 29: minimal purchase idempotency for international credit monetization.
-- Forward-only, preserves existing credit_ledger as source of truth.
-- Provider transaction id is unique to prevent double-crediting on webhook retries.

CREATE TABLE IF NOT EXISTS credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe')),
  provider_transaction_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('USD','GBP','EUR')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  credits INTEGER NOT NULL CHECK (credits > 0),
  status TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credit_purchases_provider_tx_unique UNIQUE (provider, provider_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_user ON credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_provider_tx ON credit_purchases(provider, provider_transaction_id);

ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;

-- Users can read their own purchases
CREATE POLICY "Users can view own purchases"
  ON credit_purchases FOR SELECT
  USING (auth.uid() = user_id);

-- No public INSERT/UPDATE/DELETE — writes via service role in webhook/checkout (bypass RLS).
-- Checkout initiation uses authenticated user to create a pending row via service-role insert
-- (server-authoritative); webhook finalizes.

-- Idempotent credit allocation helper (service role inserts ledger row directly).
-- No RPC needed; webhook uses service_role to insert into credit_ledger and credit_purchases.
