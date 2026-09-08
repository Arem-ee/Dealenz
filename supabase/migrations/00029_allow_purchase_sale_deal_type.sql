-- Phase 13: allow purchase_sale as a first-class deal type.
--
-- Extends the 00027 check constraint without touching any other schema.
-- Existing rows keep their values; the default stays freelance. Verified
-- live constraint name: audits_deal_type_check (from 00019 -> 00027).

ALTER TABLE audits DROP CONSTRAINT audits_deal_type_check;
ALTER TABLE audits ADD CONSTRAINT audits_deal_type_check CHECK (deal_type IN ('freelance', 'generic', 'lease', 'purchase_sale'));
