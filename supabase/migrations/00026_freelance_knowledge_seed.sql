-- Phase 5G: first production knowledge corpus (freelance vertical).
--
-- Three curated items whose claims were verified against primary sources on
-- 2026-09-04 (see provenance URIs and src/lib/knowledge/corpus.ts, which
-- mirrors this seed for test cross-checks). Status is published on insert
-- because each item was individually reviewed like code; the lifecycle in
-- store.ts still governs every later transition. If any claim is later found
-- imprecise, withdraw or supersede the item version; never rewrite history.
-- No synthetic fixtures appear here; those live only in test files.

INSERT INTO knowledge_items (
  item_key, version, title, kind, authority,
  jurisdiction_scope, jurisdiction_code,
  source_name, source_reference, source_authority, retrieved_at,
  publisher, original_uri,
  effective_from, effective_to, status, content, applicability
) VALUES
(
  'us-copyright-transfer-writing', 1,
  'US copyright transfers must be in signed writing',
  'statute', 'authoritative',
  'country', 'United States',
  'United States Code', '17 U.S.C. § 204(a)',
  'U.S. House Office of the Law Revision Counsel; U.S. Government Publishing Office',
  '2026-09-04T00:00:00Z',
  NULL,
  'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section204&num=0&edition=prelim',
  '1976-10-19', NULL, 'published',
  'Under 17 U.S.C. section 204(a), a transfer of copyright ownership, other than by operation of law, is valid only if an instrument of conveyance, or a note or memorandum of the transfer, exists in writing and is signed by the owner of the rights conveyed or that owner''s authorized agent. For freelance work, this means handing over files or granting access does not by itself transfer copyright; a signed written transfer does. Whether any particular transfer is valid depends on its facts.',
  '{"dealTypes": ["freelance", "generic"]}'
),
(
  'uk-late-payment-statutory-interest', 1,
  'UK statutory interest on late B2B payment',
  'statute', 'authoritative',
  'country', 'United Kingdom',
  'UK legislation', 'Late Payment of Commercial Debts (Interest) Act 1998; Rate of Interest (No. 2) Order 1998 (SI 1998/2765), article 4',
  'legislation.gov.uk (The National Archives); GOV.UK business guidance',
  '2026-09-04T00:00:00Z',
  NULL,
  'https://www.legislation.gov.uk/ukpga/1998/20/contents',
  '1998-11-13', NULL, 'published',
  'Under the UK Late Payment of Commercial Debts (Interest) Act 1998, qualifying business-to-business creditors may claim statutory interest on overdue debts. The rate is set at 8 percentage points over the Bank of England official dealing rate. A contract may specify a different interest rate instead. Check the current Bank of England rate before relying on any figure, since the rate moves over time.',
  '{"dealTypes": ["freelance", "generic"]}'
),
(
  'freelance-payment-practices-deposits', 1,
  'Freelance payment practices: completion, instalments, deposits',
  'industry_standard', 'industry_practice',
  'country', 'United Kingdom',
  'Federation of Small Businesses', 'FSB guide: How to write a freelance contract',
  'Federation of Small Businesses (UK business membership organisation)',
  '2026-09-04T00:00:00Z',
  'Federation of Small Businesses',
  'https://www.fsb.org.uk/resources/article/how-to-write-a-freelance-contract-MCIBHNSYF325EZTLQAEDYCDWO6Y4',
  '2026-09-04', NULL, 'published',
  'Common freelance payment practice described by the Federation of Small Businesses: freelancers are paid on project completion or in instalments, invoices are commonly payable within 30 days, and upfront fees are not uncommon for larger projects with higher costs. This describes prevalent practice, not a legal requirement; actual terms depend on each agreement.',
  '{"dealTypes": ["freelance"]}'
)
ON CONFLICT (item_key, version) DO NOTHING;
