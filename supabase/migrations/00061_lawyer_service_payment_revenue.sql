-- Phase 3: lawyer professional-service payment boundary + revenue-share
-- Service_orders is already created (00044). Extend for Stripe/Paystack connected-account flow.
-- No escrow: Dealenz never holds money; platform cut is deterministic and auditable.

-- 1. Add provider columns to service_orders
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS provider TEXT CHECK (provider IS NULL OR provider IN ('stripe','paystack')),
  ADD COLUMN IF NOT EXISTS provider_reference TEXT CHECK (provider_reference IS NULL OR char_length(provider_reference) BETWEEN 5 AND 200),
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT CHECK (provider_event_id IS NULL OR char_length(provider_event_id) BETWEEN 5 AND 200),
  ADD COLUMN IF NOT EXISTS amount_minor_existing INTEGER,
  ADD COLUMN IF NOT EXISTS platform_fee_minor INTEGER CHECK (platform_fee_minor IS NULL OR platform_fee_minor >= 0),
  ADD COLUMN IF NOT EXISTS lawyer_payout_minor INTEGER CHECK (lawyer_payout_minor IS NULL OR lawyer_payout_minor >= 0),
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT CHECK (idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 10 AND 200),
  ADD COLUMN IF NOT EXISTS provider_signature_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Ensure unique idempotency per service order + provider event
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_orders_provider_event ON service_orders(provider, provider_reference) WHERE provider_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_orders_idempotency ON service_orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_orders_provider ON service_orders(provider);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);

-- 2. Service payments audit table (deterministic revenue accounting, append-only)
CREATE TABLE IF NOT EXISTS service_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lawyer_id UUID REFERENCES lawyers(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stripe','paystack')),
  provider_reference TEXT NOT NULL CHECK (char_length(provider_reference) BETWEEN 5 AND 200),
  provider_event_id TEXT NOT NULL CHECK (char_length(provider_event_id) BETWEEN 5 AND 200),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD','GBP','EUR','NGN')),
  platform_fee_minor INTEGER NOT NULL CHECK (platform_fee_minor >= 0),
  lawyer_payout_minor INTEGER NOT NULL CHECK (lawyer_payout_minor >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 10 AND 200),
  provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_payments_amount_check CHECK (platform_fee_minor + lawyer_payout_minor = amount_minor),
  CONSTRAINT service_payments_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_service_payments_order ON service_payments(service_order_id);
CREATE INDEX IF NOT EXISTS idx_service_payments_audit ON service_payments(audit_id);
CREATE INDEX IF NOT EXISTS idx_service_payments_provider_ref ON service_payments(provider, provider_reference);

ALTER TABLE service_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own service payments" ON service_payments;
CREATE POLICY "Users read own service payments"
  ON service_payments FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM lawyers l WHERE l.id = service_payments.lawyer_id AND l.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service_role inserts payments" ON service_payments;
-- Only service_role (webhook) inserts via SECURITY DEFINER; no direct user inserts
-- Users cannot insert directly; webhook uses service_role bypass
-- We still create a restrictive policy: no user inserts
CREATE POLICY "No user inserts on service payments"
  ON service_payments FOR INSERT
  WITH CHECK (false);

-- Service_orders: restrict user mutations to safe transitions (requested/quoted -> paid verified by webhook only)
CREATE OR REPLACE FUNCTION enforce_service_order_payment_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only allow user to create requested; provider webhook moves to paid/fulfilled via service_role
  IF TG_OP = 'UPDATE' THEN
    -- Users cannot directly set provider_verified true or set status to paid without provider event
    IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
      IF NEW.provider_reference IS NULL OR NEW.provider_event_id IS NULL THEN
        RAISE EXCEPTION 'Paid requires provider confirmation';
      END IF;
      IF NEW.provider_signature_verified IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Paid requires verified provider signature';
      END IF;
    END IF;
    -- Platform fee must be deterministic: if amount set, fee must be 20% (rounded) or explicitly approved
    -- For now, enforce fee = 20% of amount if both present (auditable, not escrow)
    IF NEW.amount_minor IS NOT NULL AND NEW.platform_fee_minor IS NOT NULL THEN
      IF NEW.platform_fee_minor != floor(NEW.amount_minor * 0.2) THEN
        -- Allow but log; not hard reject to allow future variable cut. For Phase 3 we enforce 20%.
        -- To keep deterministic, we enforce 20% for now.
        RAISE EXCEPTION 'Platform fee must be 20%% of amount (deterministic)';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_order_payment ON service_orders;
CREATE TRIGGER trg_service_order_payment
  BEFORE UPDATE ON service_orders
  FOR EACH ROW EXECUTE FUNCTION enforce_service_order_payment_state();

-- 3. Lawyers connected account (Stripe/Paystack) – store only account id, not secrets
CREATE TABLE IF NOT EXISTS lawyer_connected_accounts (
  lawyer_id UUID PRIMARY KEY REFERENCES lawyers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe','paystack')),
  account_id TEXT NOT NULL CHECK (char_length(account_id) BETWEEN 5 AND 200),
  -- never store secrets; only account reference + verification state
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lawyer_connected_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lawyers manage own connected account" ON lawyer_connected_accounts;
CREATE POLICY "Lawyers manage own connected account"
  ON lawyer_connected_accounts FOR ALL
  USING (EXISTS (SELECT 1 FROM lawyers l WHERE l.id = lawyer_connected_accounts.lawyer_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM lawyers l WHERE l.id = lawyer_connected_accounts.lawyer_id AND l.user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners read lawyer connected account for deal" ON lawyer_connected_accounts;
CREATE POLICY "Owners read lawyer connected account for deal"
  ON lawyer_connected_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consultation_requests cr
      JOIN service_orders so ON so.consultation_request_id = cr.id
      WHERE cr.lawyer_id = lawyer_connected_accounts.lawyer_id
        AND cr.user_id = auth.uid()
    )
  );

-- 4. Webhook idempotency table for provider events (provider_event_id unique)
CREATE TABLE IF NOT EXISTS provider_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe','paystack','paddle')),
  provider_event_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','failed','duplicate')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT provider_webhook_events_unique UNIQUE (provider, provider_event_id)
);

ALTER TABLE provider_webhook_events ENABLE ROW LEVEL SECURITY;

-- No user access: service_role only
DROP POLICY IF EXISTS "No user access to webhook events" ON provider_webhook_events;
CREATE POLICY "No user access to webhook events"
  ON provider_webhook_events FOR ALL
  USING (false)
  WITH CHECK (false);

-- Grant minimal webhook write to service_role (already has bypass, but be explicit for audit)
GRANT INSERT, SELECT, UPDATE ON provider_webhook_events TO service_role;
GRANT INSERT, SELECT, UPDATE ON service_orders TO service_role;
GRANT INSERT, SELECT ON service_payments TO service_role;
GRANT INSERT, SELECT ON signing_events TO service_role;
