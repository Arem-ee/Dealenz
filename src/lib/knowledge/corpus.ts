// First production knowledge corpus, freelance vertical (Phase 5G).
//
// Deliberately tiny: three items whose claims were verified against primary
// sources on 2026-09-04 (see provenance URIs). Each item states what its
// source establishes and nothing more; none of them decides any user's case.
// If a future review finds any claim imprecise, withdraw the item version
// rather than editing history. Synthetic fixtures live only in fixtures.ts
// and must never enter this module.

export interface CorpusSeed {
  itemKey: string
  title: string
  kind: "statute" | "regulation" | "case_law" | "official_guidance" | "contractual_standard" | "industry_standard" | "market_practice" | "internal_policy"
  authority: "authoritative" | "official_guidance" | "secondary" | "industry_practice" | "market_practice"
  jurisdictionScope: "global" | "country" | "state_province" | "territory" | "custom"
  jurisdictionCode: string | null
  source: string
  sourceReference: string
  sourceAuthority: string
  retrievedAt: string
  publisher: string | null
  originalUri: string | null
  effectiveFrom: string
  effectiveTo: string | null
  status: "draft" | "verified" | "published" | "superseded" | "withdrawn"
  content: string
  applicability: {
    dealTypes?: Array<"freelance" | "generic" | "lease">
    industries?: string[]
    structures?: string[]
    entityTypes?: string[]
    stages?: string[]
    regulatedOnly?: boolean
    crossBorderOnly?: boolean
  }
}

export const FREELANCE_CORPUS: CorpusSeed[] = [
  {
    itemKey: "us-copyright-transfer-writing",
    title: "US copyright transfers must be in signed writing",
    kind: "statute",
    authority: "authoritative",
    jurisdictionScope: "country",
    jurisdictionCode: "United States",
    source: "United States Code",
    sourceReference: "17 U.S.C. § 204(a)",
    sourceAuthority: "U.S. House Office of the Law Revision Counsel; U.S. Government Publishing Office",
    retrievedAt: "2026-09-04T00:00:00.000Z",
    publisher: null,
    originalUri: "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section204&num=0&edition=prelim",
    effectiveFrom: "1976-10-19",
    effectiveTo: null,
    status: "published",
    content:
      "Under 17 U.S.C. section 204(a), a transfer of copyright ownership, other than by operation of law, is valid only if an instrument of conveyance, or a note or memorandum of the transfer, exists in writing and is signed by the owner of the rights conveyed or that owner's authorized agent. For freelance work, this means handing over files or granting access does not by itself transfer copyright; a signed written transfer does. Whether any particular transfer is valid depends on its facts.",
    applicability: { dealTypes: ["freelance", "generic"] },
  },
  {
    itemKey: "uk-late-payment-statutory-interest",
    title: "UK statutory interest on late B2B payment",
    kind: "statute",
    authority: "authoritative",
    jurisdictionScope: "country",
    jurisdictionCode: "United Kingdom",
    source: "UK legislation",
    sourceReference: "Late Payment of Commercial Debts (Interest) Act 1998; Rate of Interest (No. 2) Order 1998 (SI 1998/2765), article 4",
    sourceAuthority: "legislation.gov.uk (The National Archives); GOV.UK business guidance",
    retrievedAt: "2026-09-04T00:00:00.000Z",
    publisher: null,
    originalUri: "https://www.legislation.gov.uk/ukpga/1998/20/contents",
    effectiveFrom: "1998-11-13",
    effectiveTo: null,
    status: "published",
    content:
      "Under the UK Late Payment of Commercial Debts (Interest) Act 1998, qualifying business-to-business creditors may claim statutory interest on overdue debts. The rate is set at 8 percentage points over the Bank of England official dealing rate. A contract may specify a different interest rate instead. Check the current Bank of England rate before relying on any figure, since the rate moves over time.",
    applicability: { dealTypes: ["freelance", "generic"] },
  },
  {
    itemKey: "freelance-payment-practices-deposits",
    title: "Freelance payment practices: completion, instalments, deposits",
    kind: "industry_standard",
    authority: "industry_practice",
    jurisdictionScope: "country",
    jurisdictionCode: "United Kingdom",
    source: "Federation of Small Businesses",
    sourceReference: "FSB guide: How to write a freelance contract",
    sourceAuthority: "Federation of Small Businesses (UK business membership organisation)",
    retrievedAt: "2026-09-04T00:00:00.000Z",
    publisher: "Federation of Small Businesses",
    originalUri: "https://www.fsb.org.uk/resources/article/how-to-write-a-freelance-contract-MCIBHNSYF325EZTLQAEDYCDWO6Y4",
    // No publication date is stated on the guide itself; the effective date
    // is the verification date, meaning "described as current practice as of
    // this date", not a claim about when the practice began.
    effectiveFrom: "2026-09-04",
    effectiveTo: null,
    status: "published",
    content:
      "Common freelance payment practice described by the Federation of Small Businesses: freelancers are paid on project completion or in instalments, invoices are commonly payable within 30 days, and upfront fees are not uncommon for larger projects with higher costs. This describes prevalent practice, not a legal requirement; actual terms depend on each agreement.",
    applicability: { dealTypes: ["freelance"] },
  },
]
