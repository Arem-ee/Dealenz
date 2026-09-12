-- Commerce correction: Lemon Squeezy is the payment provider.
--
-- The credit_purchases provider CHECK allowed only 'stripe' (the previously
-- implemented, incorrect provider). Widen it to ('stripe', 'lemonsqueezy'):
-- historical Stripe rows are preserved untouched (never reinterpreted or
-- deleted); the live production path writes 'lemonsqueezy' only.
-- Forward-only; no historical migration edited. No live application claimed.

ALTER TABLE credit_purchases DROP CONSTRAINT IF EXISTS credit_purchases_provider_check;
ALTER TABLE credit_purchases ADD CONSTRAINT credit_purchases_provider_check CHECK (
  provider IN ('stripe', 'lemonsqueezy')
);
