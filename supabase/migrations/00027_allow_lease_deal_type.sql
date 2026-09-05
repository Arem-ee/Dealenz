-- Phase 6: allow lease as a first-class deal type.
--
-- Extends the 00019 check constraint without touching any other schema.
-- Existing rows keep their values; the default stays freelance. Verified
-- live constraint name before writing: audits_deal_type_check.

ALTER TABLE audits DROP CONSTRAINT audits_deal_type_check;
ALTER TABLE audits ADD CONSTRAINT audits_deal_type_check CHECK (deal_type IN ('freelance', 'generic', 'lease'));
