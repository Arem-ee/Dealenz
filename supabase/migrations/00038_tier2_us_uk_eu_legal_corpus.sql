-- Tier 2 (purchase_sale / lease / employment) legal corpus: US, UK, EU, Germany, France, Netherlands.
--
-- Code-owned knowledge + DB seed, mirroring 00035 (Nigeria founder/partnership).
-- Seeds verified Tier 2 legal sources as knowledge_items so the shared
-- resolver can surface them via selectPurchaseSaleCandidates /
-- selectLeaseCandidates / selectEmploymentCandidates. Small, verifiable,
-- and jurisdiction-scoped. Nigeria is not expanded here: it remains one
-- jurisdiction among many. Withdraw/supersede on error, never mutate history.
--
-- Content paraphrases the cited acts; confirm currency at the cited source.

INSERT INTO knowledge_items (
  item_key, version, title, kind, authority,
  jurisdiction_scope, jurisdiction_code,
  source_name, source_reference, source_authority, retrieved_at,
  publisher, original_uri,
  effective_from, effective_to, status, content, applicability
) VALUES
-- Purchase/Sale: US (UCC Article 2, state-adopted)
(
  'us-ucc-article2-sale', 1,
  'UCC Article 2 - Sale of goods',
  'statute', 'authoritative',
  'country', 'United States',
  'Uniform Commercial Code, Article 2', 'UCC Article 2 (Sections 2-101 to 2-725)',
  'Uniform Law Commission / state enactments (via Cornell LII)', '2026-09-09T00:00:00Z',
  'Cornell Law School', 'https://www.law.cornell.edu/ucc/2',
  '1952-01-01', NULL, 'published',
  'UCC Article 2 governs transactions in goods: formation, price and payment terms, delivery, inspection and acceptance, warranties, risk of loss, cancellation, and damages. Enacted state-by-state with variations - confirm the adopting state version; Louisiana has not adopted Article 2 in full.',
  '{"dealTypes": ["purchase_sale"]}'
),
-- Purchase/Sale: UK (Sale of Goods Act 1979, England and Wales)
(
  'uk-sale-goods-1979', 1,
  'Sale of Goods Act 1979 - Implied terms',
  'statute', 'authoritative',
  'territory', 'England and Wales',
  'Sale of Goods Act 1979', '1979 c. 54',
  'UK Parliament', '2026-09-09T00:00:00Z',
  'Legislation.gov.uk', 'https://www.legislation.gov.uk/ukpga/1979/54/contents',
  '1980-01-01', NULL, 'published',
  'Goods must be of satisfactory quality, fit for any purpose made known to the seller, and correspond with description or sample. Exclusion clauses are constrained; business-buyer remedies differ from consumer sales (see also Consumer Rights Act 2015). Confirm the revised text at legislation.gov.uk.',
  '{"dealTypes": ["purchase_sale"]}'
),
-- Purchase/Sale: EU (consumer sale of goods directive; national transposition required)
(
  'eu-sale-goods-directive-2019-771', 1,
  'Directive (EU) 2019/771 - Sale of goods',
  'statute', 'authoritative',
  'custom', 'European Union',
  'Directive (EU) 2019/771', 'Directive (EU) 2019/771',
  'European Parliament and Council', '2026-09-09T00:00:00Z',
  'EUR-Lex', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0771',
  '2019-06-11', NULL, 'published',
  'Goods must comply with the contract (description, fitness, durability); remedies are repair, replacement, price reduction, or termination. Consumer sales only; transposed per member state - for a German, French, or Dutch deal confirm the national implementation via eur-lex.europa.eu.',
  '{"dealTypes": ["purchase_sale"]}'
),
-- Lease: US/California (residential tenancy baseline; commercial is contractual)
(
  'us-ca-civil-tenancy', 1,
  'California Civil Code - Hiring of real property',
  'statute', 'authoritative',
  'state_province', 'California',
  'California Civil Code', 'Cal. Civ. Code Sections 1940-1954.05',
  'California State Legislature', '2026-09-09T00:00:00Z',
  'California Legislative Information', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1940.&lawCode=CIV',
  '1873-01-01', NULL, 'published',
  'Residential tenancies: deposits, habitability, notice, and termination. Commercial leases are primarily contractual, with different deposit and notice rules. California only - other states differ. Local ordinances may add requirements. Confirm current text at leginfo.legislature.ca.gov.',
  '{"dealTypes": ["lease"]}'
),
-- Lease: UK (business tenancies, England and Wales)
(
  'uk-landlord-tenant-1954', 1,
  'Landlord and Tenant Act 1954 Part II - Business tenancies',
  'statute', 'authoritative',
  'territory', 'England and Wales',
  'Landlord and Tenant Act 1954', '1954 c. 56, Part II',
  'UK Parliament', '2026-09-09T00:00:00Z',
  'Legislation.gov.uk', 'https://www.legislation.gov.uk/ukpga/1954/56/contents',
  '1954-11-25', NULL, 'published',
  'Qualifying business tenancies have security of tenure: the tenant may remain and apply for a new tenancy unless the landlord proves a statutory ground. Contracting out needs the prescribed procedure. Rent review, repairs, assignment, and termination interact with this protection.',
  '{"dealTypes": ["lease"]}'
),
-- Employment: US federal baseline (wages; no federal notice/just-cause rule)
(
  'us-flsa-wages', 1,
  'Fair Labor Standards Act - Minimum wage and overtime',
  'statute', 'authoritative',
  'country', 'United States',
  'Fair Labor Standards Act', '29 U.S.C. Sections 201-219',
  'U.S. Congress (via Cornell LII)', '2026-09-09T00:00:00Z',
  'Cornell Law School', 'https://www.law.cornell.edu/uscode/text/29/201',
  '1938-10-24', NULL, 'published',
  'Federal minimum wage plus overtime beyond 40 hours; exemptions turn on duties and salary tests. No federal severance, notice-period, or just-cause requirement. State overlays apply (California and New York set higher minimums). Confirm the current rate at law.cornell.edu.',
  '{"dealTypes": ["employment"]}'
),
-- Employment: UK (dismissal, notice, wages; England and Wales)
(
  'uk-employment-rights-1996', 1,
  'Employment Rights Act 1996 - Dismissal, notice, wages',
  'statute', 'authoritative',
  'territory', 'England and Wales',
  'Employment Rights Act 1996', '1996 c. 18',
  'UK Parliament', '2026-09-09T00:00:00Z',
  'Legislation.gov.uk', 'https://www.legislation.gov.uk/ukpga/1996/18/contents',
  '1996-05-22', NULL, 'published',
  'Unfair-dismissal claims need sufficient service; statutory minimum notice applies; unlawful wage deductions are prohibited; redundancy pay is governed. Written particulars from day one. Restrictive covenants must be reasonable. Confirm revised text and qualifying periods at legislation.gov.uk.',
  '{"dealTypes": ["employment"]}'
),
-- Germany foundation: sale, lease, employment (BGB)
(
  'de-bgb-contracts', 1,
  'Burgerliches Gesetzbuch - Sale, lease, employment contracts',
  'statute', 'authoritative',
  'country', 'Germany',
  'Burgerliches Gesetzbuch', 'BGB Sections 433, 535, 611a',
  'Federal Ministry of Justice', '2026-09-09T00:00:00Z',
  'gesetze-im-internet.de', 'https://www.gesetze-im-internet.de/bgb/',
  '1900-01-01', NULL, 'published',
  'Sale: seller delivers defect-free goods and transfers ownership (433). Lease: lessor grants use and maintains fitness (535). Employment: work under direction for remuneration (611a). Warranty, rent, deposit, notice, and termination differ per type. Confirm consolidated text at gesetze-im-internet.de.',
  '{"dealTypes": ["purchase_sale", "lease", "employment"]}'
),
-- France foundation: sale, lease, employment (Code civil / Code du travail)
(
  'fr-code-civil-contracts', 1,
  'Code civil / Code du travail - Sale, lease, employment',
  'statute', 'authoritative',
  'country', 'France',
  'Code civil / Code du travail', 'C. civ. art. 1582, 1708; C. trav. art. L1221-1',
  'Legifrance (Republique francaise)', '2026-09-09T00:00:00Z',
  'Legifrance', 'https://www.legifrance.gouv.fr/codes/id/LEGITEXT000006070721/',
  '1804-03-21', NULL, 'published',
  'Sale: deliver the thing, pay the price (1582). Lease (louage): use for a price (1708). Employment: subordinated work for remuneration (L1221-1). Consumer sales add Code de la consommation protections. Confirm consolidated text on Legifrance.',
  '{"dealTypes": ["purchase_sale", "lease", "employment"]}'
),
-- Netherlands foundation: sale, lease, employment (BW Book 7)
(
  'nl-bw-contracts', 1,
  'Burgerlijk Wetboek Boek 7 - Sale, lease, employment',
  'statute', 'authoritative',
  'country', 'Netherlands',
  'Burgerlijk Wetboek, Boek 7', 'BW art. 7:1, 7:201, 7:610',
  'Overheid.nl (Kingdom of the Netherlands)', '2026-09-09T00:00:00Z',
  'Overheid.nl', 'https://wetten.overheid.nl/BWBR0005290/',
  '1992-01-01', NULL, 'published',
  'Sale: deliver the thing, pay the price (7:1). Lease: use for counter-performance (7:201). Employment: work in service for wages (7:610). Non-conformity, deposit, notice, and dismissal differ per type. Confirm consolidated text at wetten.overheid.nl.',
  '{"dealTypes": ["purchase_sale", "lease", "employment"]}'
)
ON CONFLICT (item_key, version) DO NOTHING;
