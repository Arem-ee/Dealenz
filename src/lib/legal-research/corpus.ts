// International legal corpus — code-owned curated knowledge (Phases 27/31+).
//
// Founder/partnership items complement the deterministic founder/partnership
// rules; Tier 2 (purchase_sale / lease / employment) items ground the Tier 2
// rule packs for the first commercial jurisdictions (US, UK, EU, Germany,
// France, Netherlands). Nigeria remains one jurisdiction among many, never a
// default. All claims map to an authoritative source with provenance that
// passes legal-research/validation. Synthetic fixtures do not appear here.
//
// Content excerpts are short, accurate paraphrases, not verbatim
// reproductions of entire acts. Confirm currency at the cited source.

import type { Jurisdiction, LegalSource } from "./types"

function nigeria(country = "Nigeria"): Jurisdiction {
  return { scope: "country", country, region: null }
}

function seed(overrides: Partial<LegalSource> & Pick<LegalSource, "id" | "title" | "sourceReference" | "originalUri" | "excerpt" | "content">): LegalSource {
  const now = "2026-05-15T00:00:00.000Z"
  return {
    id: overrides.id,
    title: overrides.title,
    sourceReference: overrides.sourceReference,
    originalUri: overrides.originalUri,
    excerpt: overrides.excerpt,
    content: overrides.content,
    jurisdiction: overrides.jurisdiction ?? nigeria(),
    authorityTier: overrides.authorityTier ?? 1,
    kind: overrides.kind ?? "act",
    temporalStatus: overrides.temporalStatus ?? "current",
    effectiveFrom: overrides.effectiveFrom ?? "2020-08-07",
    effectiveTo: overrides.effectiveTo ?? null,
    sourceName: overrides.sourceName ?? "Companies and Allied Matters Act, 2020",
    sourceAuthority: overrides.sourceAuthority ?? "National Assembly of the Federal Republic of Nigeria (via PLAC)",
    publisher: overrides.publisher ?? "Policy and Legal Advocacy Centre (PLAC)",
    retrievedAt: overrides.retrievedAt ?? now,
    publishedAt: overrides.publishedAt ?? "2020-08-07",
    citationText: overrides.citationText ?? `CAMA 2020, ${overrides.sourceReference}`,
    contentHash: overrides.contentHash ?? null,
  } as LegalSource
}

export const NIGERIA_FOUNDER_CORPUS: LegalSource[] = [
  seed({
    id: "ng-cama-s18-types-of-companies",
    title: "CAMA 2020 — Types of companies that may be incorporated",
    sourceReference: "Section 18",
    originalUri: "https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf",
    excerpt: "A company may be incorporated as a private company, public company, or company limited by guarantee",
    content: "A company may be incorporated as a private company, public company, or company limited by guarantee, with distinct membership thresholds. CAMA 2020 Section 18 provides that private companies are the usual vehicle for startups, with a minimum of one member. Founders choosing an entity must decide the company form: it affects share issuance, transfer, and governance. Confirm the current CAC company-registration guidance at cac.gov.ng.",
  }),
  seed({
    id: "ng-cama-s22-capacity",
    title: "CAMA 2020 — Capacity and powers of a company",
    sourceReference: "Section 22",
    originalUri: "https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf",
    excerpt: "A company shall not carry on any business not authorized by its memorandum",
    content: "A company shall not carry on any business not authorized by its memorandum and shall not exceed its powers. Section 22 establishes the capacity of a company and the limits of its powers. For founder agreements, this matters because the company can only do what its constitution permits; IP assignment to the company should align with the company's objects. Verify the company's memorandum and current CAC guidance.",
  }),
  seed({
    id: "ng-cama-s53-share-capital",
    title: "CAMA 2020 — Share capital and classes",
    sourceReference: "Section 53",
    originalUri: "https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf",
    excerpt: "A company shall have a share capital which may be divided into different classes of shares",
    content: "A company shall have a share capital which may be divided into different classes of shares with rights as prescribed in the articles. Section 53 addresses share capital and the ability to create different classes. Founder ownership splits are implemented through share issuance and class rights and must later be reflected in the company's register of members and returns to the CAC.",
  }),
  seed({
    id: "ng-cama-s140-transfer-of-shares",
    title: "CAMA 2020 — Transfer of shares",
    sourceReference: "Section 140",
    originalUri: "https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf",
    excerpt: "Subject to the articles, shares in a company are transferable in the manner provided in the articles and this Act",
    content: "Subject to the articles, shares in a company are transferable in the manner provided in the articles and this Act. Section 140 is the legal basis for transfer restrictions founders negotiate (right of first refusal, board consent, lock-ups). The articles plus any shareholders' agreement must be read together; restrictions not in the articles may be unenforceable against the company.",
  }),
  seed({
    id: "ng-cama-s240-directors-duties",
    title: "CAMA 2020 — Duties of directors",
    sourceReference: "Section 305 (Part B, directors' duties)",
    originalUri: "https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf",
    excerpt: "A director shall act in good faith in the best interests of the company",
    content: "A director shall act in good faith in the best interests of the company and exercise care, diligence and skill. Part B (including Section 305) sets out directors' fiduciary duties. Founder roles as directors trigger these duties and related conflict-of-interest rules. Founders who are also directors should record how board decisions and reserved matters handle conflicts.",
  }),
  seed({
    id: "ng-cama-vesting-contractual",
    title: "CAMA 2020 — Vesting is contractual (no statutory vesting schedule)",
    sourceReference: "Part B (company/articles context); no statutory vesting",
    originalUri: "https://cac.gov.ng/resources/",
    excerpt: "CAMA does not prescribe a statutory vesting schedule",
    content: "CAMA does not prescribe a statutory vesting schedule; vesting, cliffs, and acceleration are contractual terms set in the shareholders' agreement and articles. Nigerian company law does not impose a statutory vesting schedule. Four-year vesting with a one-year cliff, acceleration on exit, and leaver provisions are contractual. They must be written into the shareholders' agreement and, where needed, reflected in the articles.",
    publisher: "Corporate Affairs Commission",
    sourceAuthority: "Corporate Affairs Commission — official company-registration guidance",
    kind: "official_guidance",
  }),
]

export const NIGERIA_PARTNERSHIP_CORPUS: LegalSource[] = [
  seed({
    id: "ng-cama-part3-llp-nature",
    title: "CAMA 2020 Part C — Nature of Limited Liability Partnership",
    sourceReference: "Part C, Limited Liability Partnerships (sections 741-809)",
    originalUri: "https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf",
    excerpt: "A limited liability partnership is a body corporate formed and incorporated under this Act",
    content: "A limited liability partnership is a body corporate formed and incorporated under this Act, distinct from its partners. Part C establishes LLPs as bodies corporate separate from their partners, with limited liability. This distinguishes LLPs from ordinary partnerships. Choice of vehicle (company vs LLP vs LP vs ordinary partnership) affects liability, governance, authority to bind, profit allocation, and registration with the CAC.",
  }),
  seed({
    id: "ng-partnership-act-1890-application",
    title: "Partnership Law — Application of Partnership Act principles in Nigeria",
    sourceReference: "Partnership Act 1890 (as applied) and CAMA 2020 savings",
    originalUri: "https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf",
    excerpt: "The relation of partnership arises from agreement",
    content: "The relation of partnership arises from agreement; persons carrying on business in common with a view of profit are partners. Nigerian partnership law derives from the Partnership Act 1890 as applied, together with CAMA 2020 savings for business names and LLPs/LPs. Founders who operate before incorporation should confirm whether their arrangement already constitutes a partnership under law and register a business name or incorporate accordingly.",
    kind: "act",
  }),
  seed({
    id: "ng-cac-business-names",
    title: "CAMA 2020 — Registration of Business Names",
    sourceReference: "Part E (Business Names)",
    originalUri: "https://cac.gov.ng/resources/",
    excerpt: "Every individual, firm or corporation carrying on business under a business name must register that name",
    content: "Every individual, firm or corporation carrying on business under a business name must register that name with the Commission. Part E requires registration of business names with the CAC. Unincorporated partnerships trading under a name must register. The CAC business-name register is the authoritative source for registration status and is searchable via cac.gov.ng. Confirm current filing requirements, fees, and forms on the CAC portal.",
    publisher: "Corporate Affairs Commission",
    sourceAuthority: "Corporate Affairs Commission — official guidance",
    kind: "official_guidance",
  }),
  seed({
    id: "ng-cama-s744-llp-agreement",
    title: "CAMA 2020 — LLP agreement governs mutual rights and duties",
    sourceReference: "Section 744 (LLP agreement)",
    originalUri: "https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf",
    excerpt: "Mutual rights and duties of partners and the LLP shall be governed by the LLP agreement",
    content: "Mutual rights and duties of partners and the LLP shall be governed by the LLP agreement, and in its absence, the First Schedule. Section 744 provides that the LLP agreement governs mutual rights and duties; otherwise statutory defaults apply. This explains why contributions, governance, decision rights, profit allocation, admission/exit, and transfer restrictions must be written into the LLP agreement.",
  }),
  seed({
    id: "ng-partnership-contributions",
    title: "Partnership — Capital contributions and profit sharing",
    sourceReference: "Partnership principles; CAMA First Schedule (LLP default)",
    originalUri: "https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf",
    excerpt: "Partners contribute capital as agreed; profits are shared equally in the absence of agreement",
    content: "Partners contribute capital as agreed; profits are shared equally in the absence of agreement to the contrary. At default, partnership profits (and, subject to agreement, losses) are shared equally unless the agreement states otherwise. This is why contribution terms and the profit/loss split must be expressly agreed. The same principle applies to capital calls: the agreement should state whether further contributions may be required and on what notice.",
  }),
]

export const NIGERIA_LEGAL_CORPUS: LegalSource[] = [...NIGERIA_FOUNDER_CORPUS, ...NIGERIA_PARTNERSHIP_CORPUS]

function us(country = "United States", region: string | null = null): Jurisdiction {
  return { scope: region ? "state_province" : "country", country, region }
}
function uk(region: string | null = null): Jurisdiction {
  return { scope: region ? "territory" : "country", country: "United Kingdom", region }
}
function eu(): Jurisdiction {
  return { scope: "custom", country: "European Union", region: null }
}

export const US_FOUNDER_CORPUS: LegalSource[] = [
  seed({
    id: "us-delaware-dgcl-s102-certificate",
    title: "Delaware General Corporation Law — Certificate of incorporation",
    sourceReference: "8 Del. C. § 102",
    originalUri: "https://delcode.delaware.gov/title8/c001/sc01/index.html#102",
    excerpt: "The certificate of incorporation shall state the name of the corporation",
    content: "The certificate of incorporation shall state the name of the corporation, the address of its registered office, the nature of its business, and the classes of stock. Delaware Section 102 governs formation; founder ownership is implemented through authorized shares and the certificate. Confirm current filing requirements at delaware.gov.",
    jurisdiction: us("United States", "Delaware"),
    sourceName: "Delaware General Corporation Law",
    sourceAuthority: "Delaware General Assembly",
    publisher: "Delaware Division of Corporations",
    kind: "act",
  }),
  seed({
    id: "us-delaware-dgcl-s141-board",
    title: "Delaware General Corporation Law — Board of directors",
    sourceReference: "8 Del. C. § 141",
    originalUri: "https://delcode.delaware.gov/title8/c001/sc04/index.html#141",
    excerpt: "The business and affairs of every corporation shall be managed by or under the direction of a board of directors",
    content: "The business and affairs of every corporation shall be managed by or under the direction of a board of directors. Section 141 establishes board authority and fiduciary duties. Founder governance and deadlocks should be addressed in bylaws and shareholders' agreement, consistent with board duties.",
    jurisdiction: us("United States", "Delaware"),
    sourceName: "Delaware General Corporation Law",
    sourceAuthority: "Delaware General Assembly",
    publisher: "Delaware Division of Corporations",
    kind: "act",
  }),
  seed({
    id: "us-delaware-dgcl-s202-transfer-restriction",
    title: "Delaware General Corporation Law — Restrictions on transfer",
    sourceReference: "8 Del. C. § 202",
    originalUri: "https://delcode.delaware.gov/title8/c001/sc06/index.html#202",
    excerpt: "A restriction on the transfer of securities may be imposed by the certificate of incorporation",
    content: "A restriction on the transfer of securities may be imposed by the certificate of incorporation, bylaws, or agreement. Section 202 is the basis for founder transfer restrictions (ROFR, board consent). Restrictions should be noted conspicuously and in the certificate to be enforceable against transferees.",
    jurisdiction: us("United States", "Delaware"),
    sourceName: "Delaware General Corporation Law",
    sourceAuthority: "Delaware General Assembly",
    publisher: "Delaware Division of Corporations",
    kind: "act",
  }),
  seed({
    id: "us-california-corp-formation",
    title: "California Corporations Code — Formation",
    sourceReference: "Cal. Corp. Code § 200",
    originalUri: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=200.&lawCode=CORP",
    excerpt: "One or more persons may form a corporation under this code",
    content: "One or more persons may form a corporation under this code by filing articles of incorporation. California Section 200 governs formation; founders should confirm current filing forms, fees, and franchise tax at leginfo.legislature.ca.gov and the California Secretary of State.",
    jurisdiction: us("United States", "California"),
    sourceName: "California Corporations Code",
    sourceAuthority: "California State Legislature",
    publisher: "California Legislative Information",
    kind: "act",
  }),
  seed({
    id: "us-newyork-bcl-402-certificate",
    title: "New York Business Corporation Law — Certificate of incorporation",
    sourceReference: "NY BCL § 402",
    originalUri: "https://www.nysenate.gov/legislation/laws/BSC/402",
    excerpt: "The certificate of incorporation shall set forth the corporate name",
    content: "The certificate of incorporation shall set forth the corporate name, the county, the purpose, and share structure. Section 402 governs New York formation; founder ownership and governance should align with the certificate and bylaws. Verify current filing at nysenate.gov.",
    jurisdiction: us("United States", "New York"),
    sourceName: "New York Business Corporation Law",
    sourceAuthority: "New York State Legislature",
    publisher: "New York State Senate",
    kind: "act",
  }),
  seed({
    id: "us-federal-securities-vesting-contractual",
    title: "Founder vesting — US contractual practice (no federal statutory vesting)",
    sourceReference: "Contractual — no federal statute",
    originalUri: "https://www.law.cornell.edu/uscode/text/15/77b",
    excerpt: "Vesting schedules are contractual; no federal statute prescribes a vesting schedule",
    content: "Vesting schedules are contractual; no federal statute prescribes a vesting schedule for founder shares. Four-year vesting with a one-year cliff and acceleration are contractual terms set in the shareholders' agreement and bylaws. Because vesting is not automatic, founders should state schedule, cliff, and repurchase price explicitly.",
    jurisdiction: us("United States", null),
    sourceName: "U.S. Code (via Cornell LII) — contractual context",
    sourceAuthority: "Legal Information Institute (Cornell Law School)",
    publisher: "Cornell Law School",
    kind: "official_guidance",
  }),
]

export const UK_FOUNDER_CORPUS: LegalSource[] = [
  seed({
    id: "uk-companies-act-s9-registration",
    title: "UK Companies Act 2006 — Registration",
    sourceReference: "Section 9",
    originalUri: "https://www.legislation.gov.uk/ukpga/2006/46/section/9",
    excerpt: "A memorandum of association is a memorandum stating that the subscribers wish to form a company",
    content: "A memorandum of association is a memorandum stating that the subscribers wish to form a company and agree to become members. Section 9 governs registration; founder ownership is implemented via the memorandum and articles. Confirm current filing at legislation.gov.uk and gov.uk.",
    jurisdiction: uk("England and Wales"),
    sourceName: "Companies Act 2006",
    sourceAuthority: "UK Parliament",
    publisher: "Legislation.gov.uk",
    kind: "act",
  }),
  seed({
    id: "uk-companies-act-s171-directors-duties",
    title: "UK Companies Act 2006 — Directors' duties",
    sourceReference: "Section 171",
    originalUri: "https://www.legislation.gov.uk/ukpga/2006/46/section/171",
    excerpt: "A director must act within powers in accordance with the company's constitution",
    content: "A director must act within powers in accordance with the company's constitution and only exercise powers for the purposes for which they are conferred. Section 171 and following set out directors' duties. Founder-directors should record how board decisions and reserved matters handle conflicts.",
    jurisdiction: uk("England and Wales"),
    sourceName: "Companies Act 2006",
    sourceAuthority: "UK Parliament",
    publisher: "Legislation.gov.uk",
    kind: "act",
  }),
  seed({
    id: "uk-companies-act-s544-transfer",
    title: "UK Companies Act 2006 — Transfer of shares",
    sourceReference: "Section 544",
    originalUri: "https://www.legislation.gov.uk/ukpga/2006/46/section/544",
    excerpt: "Shares or other interests of a member in a company are transferable in accordance with the company's articles",
    content: "Shares or other interests of a member in a company are transferable in accordance with the company's articles. Section 544 is the basis for transfer restrictions (ROFR, board consent). Restrictions should be in the articles to bind the company.",
    jurisdiction: uk("England and Wales"),
    sourceName: "Companies Act 2006",
    sourceAuthority: "UK Parliament",
    publisher: "Legislation.gov.uk",
    kind: "act",
  }),
  seed({
    id: "uk-scotland-companies-act-application",
    title: "UK Companies Act 2006 — Application to Scotland",
    sourceReference: "Section 1298 (Scotland)",
    originalUri: "https://www.legislation.gov.uk/ukpga/2006/46/section/1298",
    excerpt: "This Act extends to the whole of the United Kingdom",
    content: "This Act extends to the whole of the United Kingdom, with specific provisions for Scotland regarding registration and Scottish partnerships. Scotland has distinct partnership law and court structure; founder/partnership matters should confirm whether Scottish law applies and consult legislation.gov.uk for Scotland-specific guidance.",
    jurisdiction: uk("Scotland"),
    sourceName: "Companies Act 2006",
    sourceAuthority: "UK Parliament",
    publisher: "Legislation.gov.uk",
    kind: "act",
  }),
  seed({
    id: "uk-northern-ireland-companies-act-application",
    title: "UK Companies Act 2006 — Application to Northern Ireland",
    sourceReference: "Section 1298 (Northern Ireland)",
    originalUri: "https://www.legislation.gov.uk/ukpga/2006/46/section/1298",
    excerpt: "This Act extends to Northern Ireland with adaptations for Northern Ireland company law",
    content: "This Act extends to Northern Ireland with adaptations for Northern Ireland company law. Northern Ireland has distinct provisions for company registration and partnership. Confirm whether Northern Ireland law applies via legislation.gov.uk.",
    jurisdiction: uk("Northern Ireland"),
    sourceName: "Companies Act 2006",
    sourceAuthority: "UK Parliament",
    publisher: "Legislation.gov.uk",
    kind: "act",
  }),
  seed({
    id: "uk-llp-act-2000-nature",
    title: "UK Limited Liability Partnerships Act 2000 — Nature of LLP",
    sourceReference: "Section 1",
    originalUri: "https://www.legislation.gov.uk/ukpga/2000/12/section/1",
    excerpt: "A limited liability partnership is a body corporate formed under this Act",
    content: "A limited liability partnership is a body corporate formed under this Act, separate from its members, with limited liability. This distinguishes LLPs from ordinary partnerships. Choice of vehicle (company vs LLP vs partnership) affects liability, governance, and registration at Companies House (gov.uk).",
    jurisdiction: uk("England and Wales"),
    sourceName: "Limited Liability Partnerships Act 2000",
    sourceAuthority: "UK Parliament",
    publisher: "Legislation.gov.uk",
    kind: "act",
  }),
]

export const EU_CORPUS: LegalSource[] = [
  seed({
    id: "eu-directive-company-law",
    title: "EU Directive — Company Law (EU) 2017/1132",
    sourceReference: "Directive (EU) 2017/1132",
    originalUri: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32017L1132",
    excerpt: "Member States shall ensure that companies disclose their particulars",
    content: "Member States shall ensure that companies disclose their particulars, including constitution and capital, in the business register. Directive (EU) 2017/1132 codifies EU company law disclosure. National implementation varies; confirm German, French, or Dutch national law via eur-lex.europa.eu and the member state's register.",
    jurisdiction: eu(),
    sourceName: "Directive (EU) 2017/1132",
    sourceAuthority: "European Parliament and Council",
    publisher: "EUR-Lex",
    kind: "act",
  }),
]

function de(): Jurisdiction {
  return { scope: "country", country: "Germany", region: null }
}
function fr(): Jurisdiction {
  return { scope: "country", country: "France", region: null }
}
function nl(): Jurisdiction {
  return { scope: "country", country: "Netherlands", region: null }
}

// Tier 2 (purchase_sale / lease / employment) corpus — US/UK/EU/DE/FR/NL.
// Each item supports the deterministic Tier 2 rule packs with
// jurisdiction-scoped law. No item claims coverage it does not have:
// state-adopted law (UCC) and transposed directives say so explicitly.

export const US_TIER2_CORPUS: LegalSource[] = [
  seed({
    id: "us-ucc-article2-sale",
    title: "UCC Article 2 — Sale of goods",
    sourceReference: "UCC Article 2 (§§ 2-101–2-725)",
    originalUri: "https://www.law.cornell.edu/ucc/2",
    excerpt: "Article 2 governs transactions in goods",
    content: "Article 2 governs transactions in goods (not real estate, services, or employment). It covers formation, price and payment terms, delivery, inspection and acceptance, warranties, risk of loss, cancellation, and damages for breach. The UCC is enacted state-by-state with variations — confirm the adopting state's version, and note Louisiana has not adopted Article 2 in full. Verify the current text at law.cornell.edu.",
    jurisdiction: us("United States", null),
    sourceName: "Uniform Commercial Code, Article 2",
    sourceAuthority: "Uniform Law Commission / state enactments (via Cornell LII)",
    publisher: "Cornell Law School",
    kind: "act",
    effectiveFrom: "1952-01-01",
    publishedAt: "1952-01-01",
  }),
  seed({
    id: "us-ca-civil-tenancy",
    title: "California Civil Code — Hiring of real property",
    sourceReference: "Cal. Civ. Code §§ 1940–1954.05",
    originalUri: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1940.&lawCode=CIV",
    excerpt: "A hiring of real property in California is governed by Civil Code sections 1940 through 1954.05",
    content: "A hiring of real property in California is governed by Civil Code sections 1940 through 1954.05, covering security deposits, habitability, notice, and termination for residential tenancies. Commercial leases are primarily contractual under California law, with deposit and notice rules differing from residential. Local ordinances may add requirements. Confirm the current text at leginfo.legislature.ca.gov.",
    jurisdiction: us("United States", "California"),
    sourceName: "California Civil Code",
    sourceAuthority: "California State Legislature",
    publisher: "California Legislative Information",
    kind: "act",
    effectiveFrom: "1873-01-01",
    publishedAt: "1873-01-01",
  }),
  seed({
    id: "us-flsa-wages",
    title: "Fair Labor Standards Act — Minimum wage and overtime",
    sourceReference: "29 U.S.C. §§ 201–219",
    originalUri: "https://www.law.cornell.edu/uscode/text/29/201",
    excerpt: "Every employer shall pay to each of his employees a minimum wage",
    content: "Every employer shall pay to each of his employees a minimum wage for workweeks engaged in commerce, and overtime at one-and-one-half times the regular rate beyond 40 hours, with exemptions (executive, administrative, professional) turning on duties and salary tests. The Act does not require severance, notice periods, or just cause for termination. Confirm the current federal rate and state-law overlays (California and New York set higher minimums) at law.cornell.edu.",
    jurisdiction: us("United States", null),
    sourceName: "Fair Labor Standards Act",
    sourceAuthority: "U.S. Congress (via Cornell LII)",
    publisher: "Cornell Law School",
    kind: "act",
    effectiveFrom: "1938-10-24",
    publishedAt: "1938-06-25",
  }),
]

export const UK_TIER2_CORPUS: LegalSource[] = [
  seed({
    id: "uk-sale-goods-1979",
    title: "Sale of Goods Act 1979 — Implied terms",
    sourceReference: "1979 c. 54",
    originalUri: "https://www.legislation.gov.uk/ukpga/1979/54/contents",
    excerpt: "goods supplied under a contract of sale must be of satisfactory quality",
    content: "Under the Sale of Goods Act 1979, goods supplied under a contract of sale must be of satisfactory quality and reasonably fit for any purpose made known to the seller, and must correspond with their description or sample. Exclusion clauses are constrained, and business buyers have different remedies from consumers (see also the Consumer Rights Act 2015 for consumer sales). Confirm the current revised text at legislation.gov.uk.",
    jurisdiction: uk("England and Wales"),
    sourceName: "Sale of Goods Act 1979",
    sourceAuthority: "UK Parliament",
    publisher: "Legislation.gov.uk",
    kind: "act",
    effectiveFrom: "1980-01-01",
    publishedAt: "1979-04-06",
  }),
  seed({
    id: "uk-landlord-tenant-1954",
    title: "Landlord and Tenant Act 1954 Part II — Business tenancies",
    sourceReference: "1954 c. 56, Part II",
    originalUri: "https://www.legislation.gov.uk/ukpga/1954/56/contents",
    excerpt: "qualifying business tenancies have security of tenure",
    content: "Part II provides that qualifying business tenancies have security of tenure: the tenant may remain and apply for a new tenancy when the contractual term ends unless the landlord establishes a statutory ground for possession. Contracting out is possible only by prescribed procedure (statutory declaration). Rent review, repairing obligations, assignment, and termination interact with this protection. Confirm the current revised text at legislation.gov.uk.",
    jurisdiction: uk("England and Wales"),
    sourceName: "Landlord and Tenant Act 1954",
    sourceAuthority: "UK Parliament",
    publisher: "Legislation.gov.uk",
    kind: "act",
    effectiveFrom: "1954-11-25",
    publishedAt: "1954-11-25",
  }),
  seed({
    id: "uk-employment-rights-1996",
    title: "Employment Rights Act 1996 — Dismissal, notice, wages",
    sourceReference: "1996 c. 18",
    originalUri: "https://www.legislation.gov.uk/ukpga/1996/18/contents",
    excerpt: "employees with sufficient service may claim unfair dismissal",
    content: "The Employment Rights Act 1996 provides that employees with sufficient service may claim unfair dismissal, sets statutory minimum notice periods, protects against unlawful deductions from wages, and governs redundancy pay. Written particulars of employment must be given from day one. Restrictive covenants and confidentiality are primarily contractual and must be reasonable to be enforceable. Confirm the current revised text and qualifying periods at legislation.gov.uk.",
    jurisdiction: uk("England and Wales"),
    sourceName: "Employment Rights Act 1996",
    sourceAuthority: "UK Parliament",
    publisher: "Legislation.gov.uk",
    kind: "act",
    effectiveFrom: "1996-05-22",
    publishedAt: "1996-05-22",
  }),
]

export const EU_TIER2_CORPUS: LegalSource[] = [
  seed({
    id: "eu-sale-goods-directive-2019-771",
    title: "Directive (EU) 2019/771 — Sale of goods",
    sourceReference: "Directive (EU) 2019/771",
    originalUri: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0771",
    excerpt: "goods must comply with the contract, including description, fitness for purpose, and durability",
    content: "Directive (EU) 2019/771 requires that goods must comply with the contract, including description, fitness for purpose, and durability, and sets remedies (repair, replacement, price reduction, termination) with a reversed burden of proof for an initial period. It applies to consumer sales and was transposed into each member state's national law — for a German, French, or Dutch deal, confirm the national implementation (BGB, Code civil / Code de la consommation, Burgerlijk Wetboek) via eur-lex.europa.eu.",
    jurisdiction: eu(),
    sourceName: "Directive (EU) 2019/771",
    sourceAuthority: "European Parliament and Council",
    publisher: "EUR-Lex",
    kind: "act",
    effectiveFrom: "2019-06-11",
    publishedAt: "2019-05-22",
  }),
]

export const DE_CORPUS: LegalSource[] = [
  seed({
    id: "de-bgb-contracts",
    title: "Bürgerliches Gesetzbuch — Sale, lease, employment contracts",
    sourceReference: "BGB §§ 433, 535, 611a",
    originalUri: "https://www.gesetze-im-internet.de/bgb/",
    excerpt: "the seller must deliver the goods free of material and legal defects",
    content: "Under the BGB, the seller must deliver the goods free of material and legal defects and transfer ownership (Section 433); the lessor must grant use of the property and maintain it in a condition fit for the agreed use (Section 535); and an employment contract exists where a person performs work under direction for remuneration (Section 611a). Warranty, rent, deposit, notice, and termination rules differ per contract type. Confirm the current consolidated text at gesetze-im-internet.de.",
    jurisdiction: de(),
    sourceName: "Bürgerliches Gesetzbuch",
    sourceAuthority: "Federal Ministry of Justice (Bundesministerium der Justiz)",
    publisher: "gesetze-im-internet.de",
    kind: "act",
    effectiveFrom: "1900-01-01",
    publishedAt: "1896-08-18",
  }),
]

export const FR_CORPUS: LegalSource[] = [
  seed({
    id: "fr-code-civil-contracts",
    title: "Code civil / Code du travail — Sale, lease, employment",
    sourceReference: "C. civ. art. 1582, 1708; C. trav. art. L1221-1",
    originalUri: "https://www.legifrance.gouv.fr/codes/id/LEGITEXT000006070721/",
    excerpt: "a sale is an agreement by which one person binds himself to deliver a thing",
    content: "Under the Code civil, a sale is an agreement by which one person binds himself to deliver a thing and the other to pay for it (article 1582), and a lease (louage) grants use of property for a price (article 1708). Employment relationships are governed by the Code du travail, with the employment contract defined around subordinated work for remuneration (article L1221-1). Consumer sales add Code de la consommation protections. Confirm the current consolidated text on Légifrance.",
    jurisdiction: fr(),
    sourceName: "Code civil / Code du travail",
    sourceAuthority: "Légifrance (République française)",
    publisher: "Légifrance",
    kind: "act",
    effectiveFrom: "1804-03-21",
    publishedAt: "1804-03-21",
  }),
]

export const NL_CORPUS: LegalSource[] = [
  seed({
    id: "nl-bw-contracts",
    title: "Burgerlijk Wetboek Boek 7 — Sale, lease, employment",
    sourceReference: "BW art. 7:1, 7:201, 7:610",
    originalUri: "https://wetten.overheid.nl/BWBR0005290/",
    excerpt: "sale is the agreement whereby one party undertakes to deliver a thing",
    content: "Under Book 7 of the Burgerlijk Wetboek, sale is the agreement whereby one party undertakes to deliver a thing and the other to pay a price (article 7:1); lease grants use of property for counter-performance (article 7:201); and the employment contract is where one party undertakes to perform work in the service of the other for wages (article 7:610). Non-conformity, deposit, notice, and dismissal rules differ per contract type. Confirm the current consolidated text at wetten.overheid.nl.",
    jurisdiction: nl(),
    sourceName: "Burgerlijk Wetboek, Boek 7",
    sourceAuthority: "Overheid.nl (Kingdom of the Netherlands)",
    publisher: "Overheid.nl",
    kind: "act",
    effectiveFrom: "1992-01-01",
    publishedAt: "1991-06-28",
  }),
]

export const US_LEGAL_CORPUS: LegalSource[] = [...US_FOUNDER_CORPUS, ...US_TIER2_CORPUS]
export const UK_LEGAL_CORPUS: LegalSource[] = [...UK_FOUNDER_CORPUS, ...UK_TIER2_CORPUS]
export const EU_LEGAL_CORPUS: LegalSource[] = [...EU_CORPUS, ...EU_TIER2_CORPUS]
export const INTERNATIONAL_LEGAL_CORPUS: LegalSource[] = [...NIGERIA_LEGAL_CORPUS, ...US_LEGAL_CORPUS, ...UK_LEGAL_CORPUS, ...EU_LEGAL_CORPUS, ...DE_CORPUS, ...FR_CORPUS, ...NL_CORPUS]
