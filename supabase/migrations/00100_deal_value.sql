-- 00100: deal value capture (phase 1: store + display, no FX).
--
-- Optional contract value per deal, in minor units + ISO currency —
-- the same storage convention as billing (catalog minor units, no
-- floats). History stays NULL (absent, never zero): backfilled values
-- arrive only through user confirmation or AI inference merged into the
-- context envelope, and the columns mirror user_confirmed envelope
-- fields as query accelerators. Reports sums by currency and counts
-- coverage (n with value / total); nothing converts across currencies.

ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS deal_value_minor BIGINT CHECK (deal_value_minor IS NULL OR deal_value_minor >= 0);

ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS deal_value_currency CHAR(3) CHECK (deal_value_currency IS NULL OR deal_value_currency IN ('USD', 'GBP', 'EUR', 'NGN'));

ALTER TABLE audits
  DROP CONSTRAINT IF EXISTS audits_value_pair_check;

ALTER TABLE audits
  ADD CONSTRAINT audits_value_pair_check
  CHECK (
    (deal_value_minor IS NULL AND deal_value_currency IS NULL)
    OR (deal_value_minor IS NOT NULL AND deal_value_currency IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_audits_value_currency
  ON audits (deal_value_currency) WHERE deal_value_minor IS NOT NULL;
