ALTER TABLE credit_purchases DROP CONSTRAINT IF EXISTS credit_purchases_provider_check;
ALTER TABLE credit_purchases ADD CONSTRAINT credit_purchases_provider_check CHECK (
  provider IN ('stripe', 'lemonsqueezy', 'paddle')
);
