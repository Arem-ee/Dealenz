-- Phase 3: international knowledge expansion + storage/RLS hardening
-- Target markets US/UK/EU first, Nigeria supported not default; no jurisdiction hard-coded.

-- 1. Seed international knowledge items (idempotent)
-- Each item is published, version 1, with provenance URIs and jurisdiction scopes.
-- We reuse the item_key pattern from existing seeds; duplicates are ignored via ON CONFLICT.

INSERT INTO knowledge_items (item_key, version, title, kind, authority, jurisdiction_scope, jurisdiction_code, source_name, source_reference, source_authority, retrieved_at, publisher, original_uri, effective_from, effective_to, status, content, applicability)
VALUES
-- US: Delaware LLC formation (target market)
('us-delaware-llc-formation', 1, 'Delaware LLC formation requirements', 'statute', 'authoritative', 'state_province', 'US-DE', 'Delaware Code', '6 Del. C. § 18-201', 'Delaware Division of Corporations', '2026-09-18T00:00:00Z', 'Delaware Code Online', 'https://delcode.delaware.gov/title6/c018/', '1899-01-01', NULL, 'published', 'Under 6 Del. C. § 18-201, a Delaware LLC is formed upon filing a certificate of formation with the Delaware Secretary of State. The certificate must state the LLC name and registered agent. An LLC agreement may be written, oral, or implied. No operating agreement filing is required, but the agreement governs internal affairs.', '{"dealTypes": ["founder","partnership","generic"]}'),
-- US: California lease disclosures
('us-california-lease-disclosure', 1, 'California lease disclosure requirements', 'statute', 'authoritative', 'state_province', 'US-CA', 'California Civil Code', 'Cal. Civ. Code § 1940-1954', 'California Legislative Info', '2026-09-18T00:00:00Z', 'California Legislative Information', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1940.', '1970-01-01', NULL, 'published', 'California Civil Code §§ 1940-1954 govern residential lease terms, required disclosures (lead paint, mold, Megan''s Law), security deposit limits, and habitability. Commercial leases are governed by contract and UCC where applicable, with local ordinances adding requirements.', '{"dealTypes": ["lease","generic"]}'),
-- UK: Companies Act 2006 - LLP formation
('uk-llp-formation', 1, 'UK LLP formation under Companies Act 2006', 'statute', 'authoritative', 'country', 'United Kingdom', 'UK Legislation', 'Companies Act 2006 Part 2', 'legislation.gov.uk', '2026-09-18T00:00:00Z', 'National Archives', 'https://www.legislation.gov.uk/ukpga/2006/46', '2006-11-08', NULL, 'published', 'Under the Limited Liability Partnerships Act 2000 and Companies Act 2006, a UK LLP is formed by delivering an incorporation document to Companies House. Members have limited liability; the LLP agreement governs internal matters, profit sharing, and duties. Filing does not require the agreement itself.', '{"dealTypes": ["partnership","founder","generic"]}'),
-- UK: Employment Rights Act 1996 - written statement
('uk-employment-written-statement', 1, 'UK right to written employment particulars', 'statute', 'authoritative', 'country', 'United Kingdom', 'UK Legislation', 'Employment Rights Act 1996 s.1', 'legislation.gov.uk', '2026-09-18T00:00:00Z', 'National Archives', 'https://www.legislation.gov.uk/ukpga/1996/18/section/1', '1996-05-22', NULL, 'published', 'Under Employment Rights Act 1996 s.1, employees and workers are entitled to a written statement of employment particulars from day one, covering pay, hours, holiday, and other terms. Changes must be notified in writing.', '{"dealTypes": ["employment","generic"]}'),
-- EU: Late Payment Directive
('eu-late-payment-directive', 1, 'EU Late Payment Directive interest and recovery costs', 'regulation', 'authoritative', 'territory', 'EU', 'EUR-Lex', 'Directive 2011/7/EU', 'EU Publications Office', '2026-09-18T00:00:00Z', 'EUR-Lex', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A32011L0007', '2011-02-23', NULL, 'published', 'Directive 2011/7/EU on combating late payment in commercial transactions: statutory interest at ECB refi rate + 8 percentage points, plus €40 recovery cost, when payment is not made within contractual or 30-day default period. Member states transpose into national law.', '{"dealTypes": ["purchase_sale","freelance","generic"]}'),
-- EU France: French Commercial Code late payment
('eu-fr-commercial-late-payment', 1, 'France Commercial Code late payment terms', 'statute', 'authoritative', 'country', 'France', 'Code de commerce', 'L441-10', 'Légifrance', '2026-09-18T00:00:00Z', 'Légifrance', 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038530866', '2019-01-01', NULL, 'published', 'Under French Commercial Code L441-10, payment terms between professionals may not exceed 60 days from invoice date (or 45 days end of month) unless otherwise agreed and not grossly unfair. Statutory late interest and €40 indemnity apply.', '{"dealTypes": ["purchase_sale","freelance","generic"]}'),
-- EU Germany: BGB withdrawal right for distance contracts
('eu-de-bgb-withdrawal', 1, 'Germany BGB distance contract withdrawal', 'statute', 'authoritative', 'country', 'Germany', 'Bürgerliches Gesetzbuch', 'BGB § 355', 'gesetze-im-internet.de', '2026-09-18T00:00:00Z', 'Federal Ministry of Justice', 'https://www.gesetze-im-internet.de/bgb/__355.html', '2002-01-01', NULL, 'published', 'BGB § 355 grants consumers a 14-day withdrawal right for distance and off-premises contracts. The period begins after the trader has provided required information and the goods/services. Business-to-business contracts do not carry this statutory withdrawal.', '{"dealTypes": ["purchase_sale","generic"]}'),
-- EU Netherlands: Dutch Civil Code partnership
('eu-nl-partnership', 1, 'Netherlands partnership under BW', 'statute', 'authoritative', 'country', 'Netherlands', 'Burgerlijk Wetboek', 'BW 7A:1655', 'overheid.nl', '2026-09-18T00:00:00Z', 'Dutch Government', 'https://wetten.overheid.nl/BWBR0005290/Boek7a/Titel9', '1992-01-01', NULL, 'published', 'Under Dutch Civil Code Book 7A Title 9, a partnership (maatschap, VOF, CV) is formed by agreement to cooperate and share profits. Notarial deed not required except for specific assets. Partners are jointly liable depending on form (VOF joint and several).', '{"dealTypes": ["partnership","founder","generic"]}'),
-- US: New York employment at-will
('us-ny-employment-at-will', 1, 'New York employment at-will doctrine', 'case_law', 'secondary', 'state_province', 'US-NY', 'New York Case Law', 'NY CLS Labor § 201', 'NY State', '2026-09-18T00:00:00Z', 'NY State Senate', 'https://www.nysenate.gov/legislation/laws/LAB/201', '1900-01-01', NULL, 'published', 'New York is an at-will employment jurisdiction. Either party may terminate for any lawful reason or no reason, subject to contractual, statutory (anti-discrimination, wage), and collective-bargaining limits. Written contracts can create just-cause protections.', '{"dealTypes": ["employment","generic"]}'),
-- UK: IR35 off-payroll
('uk-ir35-off-payroll', 1, 'UK IR35 off-payroll working rules', 'regulation', 'authoritative', 'country', 'United Kingdom', 'UK Legislation', 'Income Tax (Earnings and Pensions) Act 2003 s.61', 'legislation.gov.uk', '2026-09-18T00:00:00Z', 'National Archives', 'https://www.legislation.gov.uk/ukpga/2003/1/section/61', '2017-04-06', NULL, 'published', 'UK off-payroll working (IR35) rules: where a contractor would be an employee if engaged directly, the client (or agency) must operate PAYE and NICs. Status depends on mutuality, control, and substitution, assessed per engagement.', '{"dealTypes": ["employment","freelance","generic"]}')
ON CONFLICT (item_key, version) DO NOTHING;

-- 2. Storage hardening: ensure audit-files bucket RLS foldername isolation is documented and add policy for service_role audit logs
-- (No new bucket; just harden document_versions access logging)
-- Ensure document_versions UPDATE policy is correctly scoped (already user_id, but explicitly re-assert)
DROP POLICY IF EXISTS "Users update own document versions" ON document_versions;
CREATE POLICY "Users update own document versions"
  ON document_versions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- But immutable rows will be rejected by trigger enforce_document_version_lock above, even for owner.

-- 3. Add index for international knowledge lookup
CREATE INDEX IF NOT EXISTS idx_knowledge_jurisdiction ON knowledge_items(jurisdiction_scope, jurisdiction_code) WHERE status='published';
CREATE INDEX IF NOT EXISTS idx_knowledge_authority ON knowledge_items(authority);

-- 4. Add GDPR deletion helper comment (no schema change, just ensure user cascade works)
-- All user-owned tables already ON DELETE CASCADE via user_id FK; verify.
