-- Phase 14: allow employment as a first-class deal type.
--
-- Extends the 00029 check constraint without touching any other schema.
-- Existing rows keep their values; the default stays freelance. Verified
-- live constraint name: audits_deal_type_check (from 00019 -> 00029).

ALTER TABLE audits DROP CONSTRAINT audits_deal_type_check;
ALTER TABLE audits ADD CONSTRAINT audits_deal_type_check CHECK (deal_type IN ('freelance', 'generic', 'lease', 'purchase_sale', 'employment'));
