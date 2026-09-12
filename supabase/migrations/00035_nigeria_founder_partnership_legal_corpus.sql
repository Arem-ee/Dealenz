-- Phase 27: Nigeria founder/partnership legal corpus — code-owned knowledge + DB seed.
--
-- Seeds verified Nigerian founder/partnership legal sources (CAMA 2020,
-- CAC guidance) as knowledge_items with jurisdiction Nigeria so the shared
-- resolver can surface them via selectFounderCandidates / selectPartnershipCandidates.
-- Small, verifiable, and jurisdiction-scoped. Withdraw/supersede on error,
-- never mutate history.

INSERT INTO knowledge_items (
  item_key, version, title, kind, authority,
  jurisdiction_scope, jurisdiction_code,
  source_name, source_reference, source_authority, retrieved_at,
  publisher, original_uri,
  effective_from, effective_to, status, content, applicability
) VALUES
-- Founder (company / governance)
(
  'ng-cama-s18-types-of-companies', 1,
  'CAMA 2020 — Types of companies that may be incorporated',
  'statute', 'authoritative',
  'country', 'Nigeria',
  'Companies and Allied Matters Act, 2020', 'Section 18',
  'National Assembly of the Federal Republic of Nigeria (via PLAC)', '2026-05-15T00:00:00Z',
  'Policy and Legal Advocacy Centre (PLAC)', 'https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf',
  '2020-08-07', NULL, 'published',
  'CAMA 2020 Section 18: companies may be formed as private, public, or limited by guarantee. Private companies are the usual startup vehicle. Choice of form affects share issuance, transfer, and governance. Confirm current CAC filing forms and fees at cac.gov.ng.',
  '{"dealTypes": ["founder", "partnership"], "stages": []}'
),
(
  'ng-cama-s140-transfer-of-shares', 1,
  'CAMA 2020 — Transfer of shares',
  'statute', 'authoritative',
  'country', 'Nigeria',
  'Companies and Allied Matters Act, 2020', 'Section 140',
  'National Assembly of the Federal Republic of Nigeria (via PLAC)', '2026-05-15T00:00:00Z',
  'Policy and Legal Advocacy Centre (PLAC)', 'https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf',
  '2020-08-07', NULL, 'published',
  'Section 140: shares are transferable subject to the articles and the Act. Transfer restrictions (ROFR, board consent, lock-ups) must be in the articles to bind the company; a shareholders'' agreement alone may be unenforceable against the company.',
  '{"dealTypes": ["founder"]}'
),
(
  'ng-cama-s240-directors-duties', 1,
  'CAMA 2020 — Duties of directors',
  'statute', 'authoritative',
  'country', 'Nigeria',
  'Companies and Allied Matters Act, 2020', 'Section 305',
  'National Assembly of the Federal Republic of Nigeria (via PLAC)', '2026-05-15T00:00:00Z',
  'Policy and Legal Advocacy Centre (PLAC)', 'https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf',
  '2020-08-07', NULL, 'published',
  'Part B (Section 305): directors must act in good faith in the company''s best interests and with care, diligence and skill. Founders who are directors trigger fiduciary duties and conflict rules; record board decisions and reserved matters handling.',
  '{"dealTypes": ["founder"]}'
),
-- Partnership
(
  'ng-cama-part3-llp-nature', 1,
  'CAMA 2020 Part C — Nature of Limited Liability Partnership',
  'statute', 'authoritative',
  'country', 'Nigeria',
  'Companies and Allied Matters Act, 2020', 'Part C (LLP, sections 741-809)',
  'National Assembly of the Federal Republic of Nigeria (via PLAC)', '2026-05-15T00:00:00Z',
  'Policy and Legal Advocacy Centre (PLAC)', 'https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf',
  '2020-08-07', NULL, 'published',
  'Part C: an LLP is a body corporate distinct from its partners, with limited liability. This distinguishes LLPs from ordinary partnerships and LPs. Vehicle choice (company vs LLP vs LP vs partnership) affects liability, authority, profit allocation, and CAC registration.',
  '{"dealTypes": ["partnership", "founder"]}'
),
(
  'ng-cac-business-names', 1,
  'CAMA 2020 — Registration of Business Names',
  'official_guidance', 'official_guidance',
  'country', 'Nigeria',
  'Corporate Affairs Commission', 'Part E (Business Names)',
  'Corporate Affairs Commission — official guidance', '2026-05-15T00:00:00Z',
  'Corporate Affairs Commission', 'https://cac.gov.ng/resources/',
  '2020-08-07', NULL, 'published',
  'Part E: every individual, firm or corporation trading under a business name must register it with the CAC. Unincorporated partnerships must register. Check cac.gov.ng for current filing requirements, fees, and forms; the CAC register is the authoritative source for registration status.',
  '{"dealTypes": ["partnership", "founder"]}'
),
(
  'ng-partnership-contributions', 1,
  'Partnership — Capital contributions and profit sharing (default)',
  'statute', 'authoritative',
  'country', 'Nigeria',
  'Partnership Act 1890 (as applied) and CAMA First Schedule (LLP default)', 'Partnership principles; CAMA First Schedule',
  'National Assembly (via PLAC) / Partnership Act', '2026-05-15T00:00:00Z',
  'Policy and Legal Advocacy Centre (PLAC)', 'https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf',
  '1890-01-01', NULL, 'published',
  'At default, partnership profits are shared equally unless the agreement states otherwise. Contribution terms and the profit/loss split must be expressly agreed. The same applies to capital calls: state whether further contributions may be required and on what notice.',
  '{"dealTypes": ["partnership"]}'
)
ON CONFLICT (item_key, version) DO NOTHING;
