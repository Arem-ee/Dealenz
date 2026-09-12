// Document families — international, jurisdiction-neutral (Phase 28).
//
// Families are defined by dealType + protection category, not by country.
// Jurisdiction-specific law is injected via legal citations at assembly,
// not by hardcoding Nigeria into the template engine. A synthetic fixture
// jurisdiction (Testland) is used only to prove the architecture is not
// Nigeria-hardcoded; it is never presented as real legal coverage.

import type { DocumentFamily } from "./types"

export const DOCUMENT_FAMILIES: DocumentFamily[] = [
  {
    id: "founder-agreement",
    dealTypes: ["founder"],
    title: "Founder Agreement",
    description: "Core founder terms: ownership, roles, IP, governance, transfer, liability.",
    protectionCategories: ["ownership", "vesting", "roles", "governance", "ip", "transfer", "liability", "leaver"],
    requiredJurisdiction: true,
    clauseIds: [
      "founder-ownership-allocation",
      "founder-vesting-schedule",
      "founder-ip-assignment",
      "founder-governance-reserved-matters",
      "founder-transfer-restriction",
      "founder-liability-limitation",
    ],
    legalContextIds: ["ng-cama-s18-types-of-companies", "ng-cama-s140-transfer-of-shares", "ng-cama-s240-directors-duties"],
  },
  {
    id: "shareholders-agreement",
    dealTypes: ["founder"],
    title: "Shareholders Agreement",
    description: "Share rights, transfer, pre-emption, and governance for the cap table.",
    protectionCategories: ["ownership", "transfer", "governance", "dilution"],
    requiredJurisdiction: true,
    clauseIds: ["founder-ownership-allocation", "founder-transfer-restriction", "founder-dilution-protection", "founder-governance-reserved-matters"],
    legalContextIds: ["ng-cama-s18-types-of-companies", "ng-cama-s53-share-capital", "ng-cama-s140-transfer-of-shares"],
  },
  {
    id: "founder-ip-assignment",
    dealTypes: ["founder"],
    title: "Founder IP Assignment",
    description: "Assignment of founder-created IP to the company.",
    protectionCategories: ["ip"],
    requiredJurisdiction: true,
    clauseIds: ["founder-ip-assignment"],
    legalContextIds: ["ng-cama-s22-capacity"],
  },
  {
    id: "vesting-schedule",
    dealTypes: ["founder"],
    title: "Vesting Schedule",
    description: "Vesting, cliff, and acceleration terms.",
    protectionCategories: ["vesting", "leaver"],
    requiredJurisdiction: true,
    clauseIds: ["founder-vesting-schedule", "founder-leaver-buyout"],
    legalContextIds: ["ng-cama-vesting-contractual"],
  },
  {
    id: "partnership-agreement",
    dealTypes: ["partnership"],
    title: "Partnership Agreement",
    description: "Ordinary partnership: contributions, profit, authority, governance, transfer, liability, dissolution.",
    protectionCategories: ["contribution", "profit", "authority", "governance", "transfer", "liability", "dissolution", "exit"],
    requiredJurisdiction: true,
    clauseIds: [
      "partnership-contributions-schedule",
      "partnership-profit-allocation",
      "partnership-authority-management",
      "partnership-governance-deadlock",
      "partnership-transfer-restriction",
      "partnership-liability-allocation",
      "partnership-exit-dissolution",
    ],
    legalContextIds: ["ng-partnership-contributions", "ng-cama-part3-llp-nature", "ng-cac-business-names"],
  },
  {
    id: "llp-agreement",
    dealTypes: ["partnership"],
    title: "LLP Agreement",
    description: "Limited Liability Partnership agreement (body corporate, limited liability).",
    protectionCategories: ["contribution", "profit", "authority", "governance", "transfer", "liability", "dissolution"],
    requiredJurisdiction: true,
    clauseIds: [
      "partnership-contributions-schedule",
      "partnership-profit-allocation",
      "partnership-authority-management",
      "partnership-governance-deadlock",
      "partnership-transfer-restriction",
      "partnership-liability-allocation",
      "partnership-exit-dissolution",
    ],
    legalContextIds: ["ng-cama-part3-llp-nature", "ng-cama-s744-llp-agreement", "ng-partnership-contributions"],
  },
  {
    id: "contribution-schedule",
    dealTypes: ["partnership"],
    title: "Contribution Schedule",
    description: "Capital contributions and capital-call mechanics.",
    protectionCategories: ["contribution"],
    requiredJurisdiction: true,
    clauseIds: ["partnership-contributions-schedule"],
    legalContextIds: ["ng-partnership-contributions"],
  },
  {
    id: "profit-schedule",
    dealTypes: ["partnership"],
    title: "Profit/Loss Schedule",
    description: "Profit and loss allocation and distribution timing.",
    protectionCategories: ["profit"],
    requiredJurisdiction: true,
    clauseIds: ["partnership-profit-allocation"],
    legalContextIds: ["ng-partnership-contributions"],
  },
  {
    id: "purchase-terms-sheet",
    dealTypes: ["purchase_sale"],
    title: "Purchase Terms Sheet",
    description: "Key sale terms: price and payment, inspection and warranty, title transfer. A negotiation starting point, not a complete sale agreement.",
    protectionCategories: ["payment", "warranty", "transfer"],
    requiredJurisdiction: true,
    clauseIds: [
      "purchase-price-payment-terms",
      "purchase-inspection-acceptance",
      "purchase-title-transfer",
    ],
    legalContextIds: ["us-ucc-article2-sale", "uk-sale-goods-1979", "eu-sale-goods-directive-2019-771", "de-bgb-contracts", "fr-code-civil-contracts", "nl-bw-contracts"],
  },
  {
    id: "lease-terms-summary",
    dealTypes: ["lease"],
    title: "Lease Terms Summary",
    description: "Key lease terms: rent and deposit, term and termination, maintenance, subletting. A negotiation starting point, not a complete lease.",
    protectionCategories: ["payment", "term", "termination", "maintenance", "transfer"],
    requiredJurisdiction: true,
    clauseIds: [
      "lease-rent-deposit",
      "lease-term-termination",
      "lease-maintenance-repairs",
      "lease-subletting-consent",
    ],
    legalContextIds: ["us-ca-civil-tenancy", "uk-landlord-tenant-1954", "de-bgb-contracts", "fr-code-civil-contracts", "nl-bw-contracts"],
  },
  {
    id: "employment-terms-summary",
    dealTypes: ["employment"],
    title: "Employment Terms Summary",
    description: "Key employment terms: compensation, duties and probation, termination and notice. A negotiation starting point, not a complete contract.",
    protectionCategories: ["compensation", "roles", "term", "termination"],
    requiredJurisdiction: true,
    clauseIds: [
      "employment-compensation-terms",
      "employment-duties-probation",
      "employment-termination-notice",
    ],
    legalContextIds: ["us-flsa-wages", "uk-employment-rights-1996", "de-bgb-contracts", "fr-code-civil-contracts", "nl-bw-contracts"],
  },
]

export function familiesForDealType(dealType: string): DocumentFamily[] {
  return DOCUMENT_FAMILIES.filter((f) => f.dealTypes.includes(dealType as never))
}

export function familyById(id: string): DocumentFamily | null {
  return DOCUMENT_FAMILIES.find((f) => f.id === id) ?? null
}

export function isFamilySupportedForJurisdiction(family: DocumentFamily, jurisdictionCountry: string): boolean {
  // Families themselves are jurisdiction-neutral; legal coverage is verified
  // separately via the legal-research layer. We do not pretend a synthetic
  // fixture (Testland) has real legal support — the caller checks coverage
  // via legal research, not via this function.
  void family
  void jurisdictionCountry
  return true
}
