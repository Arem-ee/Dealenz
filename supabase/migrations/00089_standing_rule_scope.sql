-- 00089: standing-instruction deal-type scoping.
--
-- A rule with an empty deal_types array applies to every deal (the original
-- behavior). A rule listing deal types applies only when the analyzed deal
-- matches one of them. Forward-only, additive: one nullable-free column with
-- a universal default, no RLS change, no backfill needed (existing rows keep
-- applying everywhere, exactly as before).

ALTER TABLE standing_instructions
  ADD COLUMN IF NOT EXISTS deal_types TEXT[] NOT NULL DEFAULT '{}';
