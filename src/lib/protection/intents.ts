// Protection intent model (Phase 28).
//
// A protection intent is a structured, actionable protection derived from
// an authoritative finding. It never rediscovers facts — it references the
// finding that determined the risk, preserves its evidence, and adds
// negotiation guidance, legal context, and an optional clause pointer.
// AI may explain or adapt, but never invent law or facts.

import type { RuleResult } from "@/lib/rules/result"
import type { Jurisdiction, LegalCitation } from "@/lib/legal-research/types"
import { INTERNATIONAL_LEGAL_CORPUS } from "@/lib/legal-research/corpus"
import { citationFromSource } from "@/lib/legal-research/citations"
import type { Evidence } from "@/lib/evidence/schema"

export type ProtectionCategory =
  | "ownership"
  | "vesting"
  | "ip"
  | "roles"
  | "governance"
  | "leaver"
  | "transfer"
  | "liability"
  | "dilution"
  | "contribution"
  | "profit"
  | "authority"
  | "exit"
  | "dissolution"
  | "confidentiality"
  | "structure"
  | "payment"
  | "subject"
  | "delivery"
  | "warranty"
  | "term"
  | "termination"
  | "maintenance"
  | "compensation"
  | "general"

export type ProtectionPriority = "critical" | "important" | "consider"

export type ProtectionStatus = "needs_input" | "ready" | "unknown"

export interface ProtectionIntent {
  id: string // ruleKey
  dealType: string
  findingId: string // ruleKey
  category: ProtectionCategory
  title: string
  problem: string // finding.summary
  recommendation: string // finding.guidance
  rationale: string // why it matters (from severity)
  priority: ProtectionPriority
  evidence: Evidence[]
  legalContext: LegalCitation | null
  status: ProtectionStatus
  variables: string[] // required inputs that are missing (e.g. "ownership percentages")
}

function rationaleForSeverity(severity: string): string {
  switch (severity) {
    case "critical":
      return "Likely to affect your rights or obligations. Clarify before signing."
    case "material":
      return "Could materially affect payment, scope, liability, or risk."
    case "attention":
      return "Worth confirming to avoid later disagreement or added cost."
    default:
      return "Helpful context for a complete picture."
  }
}

function priorityForSeverity(severity: string): ProtectionPriority {
  if (severity === "critical") return "critical"
  if (severity === "material") return "important"
  return "consider"
}

function categoryForRuleKey(ruleKey: string): ProtectionCategory {
  // Tier 2 deal types dispatch by rule-key prefix first: generic substring
  // checks below (e.g. "term" → dissolution) must never capture Tier 2 keys.
  if (ruleKey.startsWith("purchase-") || ruleKey.startsWith("lease-") || ruleKey.startsWith("employment-")) {
    return categoryForTier2RuleKey(ruleKey)
  }
  if (ruleKey.includes("ownership")) return "ownership"
  if (ruleKey.includes("vesting")) return "vesting"
  if (ruleKey.includes("ip-assignment") || ruleKey.includes("ip-")) return "ip"
  if (ruleKey.includes("roles")) return "roles"
  if (ruleKey.includes("governance") || ruleKey.includes("deadlock") || ruleKey.includes("decision")) return "governance"
  if (ruleKey.includes("leaver") || ruleKey.includes("exit")) return "leaver"
  if (ruleKey.includes("transfer")) return "transfer"
  if (ruleKey.includes("liability")) return "liability"
  if (ruleKey.includes("dilution")) return "dilution"
  if (ruleKey.includes("contribution")) return "contribution"
  if (ruleKey.includes("profit")) return "profit"
  if (ruleKey.includes("authority") || ruleKey.includes("management")) return "authority"
  if (ruleKey.includes("dissolution") || ruleKey.includes("term")) return "dissolution"
  if (ruleKey.includes("confidentiality") || ruleKey.includes("nda")) return "confidentiality"
  if (ruleKey.includes("structure") || ruleKey.includes("partnership-structure")) return "structure"
  return "general"
}

// Tier 2 (purchase_sale / lease / employment) category mapping. Keys are
// stable rule keys (purchase-*, lease-*, employment-*); mapping is exact
// enough to stay stable as new Tier 2 rules are added with the same prefix.
function categoryForTier2RuleKey(ruleKey: string): ProtectionCategory {
  if (ruleKey.includes("liability")) return "liability"
  if (ruleKey.includes("price") || ruleKey.includes("rent") || ruleKey.includes("deposit") || ruleKey.includes("payment")) return "payment"
  if (ruleKey.includes("compensation")) return "compensation"
  if (ruleKey.includes("permitted-use") || ruleKey.includes("asset")) return "subject"
  if (ruleKey.includes("completion") || ruleKey.includes("delivery") || ruleKey.includes("possession")) return "delivery"
  if (ruleKey.includes("inspection") || ruleKey.includes("warrant")) return "warranty"
  if (ruleKey.includes("termination") || ruleKey.includes("notice")) return "termination"
  // Transfer before term: "subletting-terms-present" contains "term".
  if (ruleKey.includes("title-transfer") || ruleKey.includes("subletting") || ruleKey.includes("assignment")) return "transfer"
  if (ruleKey.includes("term") || ruleKey.includes("commencement") || ruleKey.includes("duration") || ruleKey.includes("probation")) return "term"
  if (ruleKey.includes("maintenance") || ruleKey.includes("repair") || ruleKey.includes("utilities") || ruleKey.includes("insurance")) return "maintenance"
  if (ruleKey.includes("duties") || ruleKey.includes("role")) return "roles"
  return "general"
}

// Tier 2 (purchase_sale / lease / employment) legal grounding by deal type,
// jurisdiction, and protection category. Only genuinely supporting sources
// are listed: state-adopted law is region-gated at lookup (e.g. California
// tenancy law never grounds a New York lease), and jurisdictions without a
// supporting source yield null (honest NOT_FOUND), never another country's law.
const TIER2_DEAL_TYPES = new Set(["purchase_sale", "lease", "employment"])

const TIER2_LEGAL_CONTEXT: Record<string, Record<string, Partial<Record<ProtectionCategory, string>>>> = {
  purchase_sale: {
    "United States": {
      payment: "us-ucc-article2-sale",
      subject: "us-ucc-article2-sale",
      delivery: "us-ucc-article2-sale",
      warranty: "us-ucc-article2-sale",
      transfer: "us-ucc-article2-sale",
      termination: "us-ucc-article2-sale",
      liability: "us-ucc-article2-sale",
    },
    "United Kingdom": {
      payment: "uk-sale-goods-1979",
      subject: "uk-sale-goods-1979",
      delivery: "uk-sale-goods-1979",
      warranty: "uk-sale-goods-1979",
      transfer: "uk-sale-goods-1979",
      termination: "uk-sale-goods-1979",
      liability: "uk-sale-goods-1979",
    },
    "European Union": {
      payment: "eu-sale-goods-directive-2019-771",
      subject: "eu-sale-goods-directive-2019-771",
      delivery: "eu-sale-goods-directive-2019-771",
      warranty: "eu-sale-goods-directive-2019-771",
      transfer: "eu-sale-goods-directive-2019-771",
      termination: "eu-sale-goods-directive-2019-771",
    },
    Germany: {
      payment: "de-bgb-contracts",
      subject: "de-bgb-contracts",
      delivery: "de-bgb-contracts",
      warranty: "de-bgb-contracts",
      transfer: "de-bgb-contracts",
      termination: "de-bgb-contracts",
    },
    France: {
      payment: "fr-code-civil-contracts",
      subject: "fr-code-civil-contracts",
      delivery: "fr-code-civil-contracts",
      warranty: "fr-code-civil-contracts",
      transfer: "fr-code-civil-contracts",
      termination: "fr-code-civil-contracts",
    },
    Netherlands: {
      payment: "nl-bw-contracts",
      subject: "nl-bw-contracts",
      delivery: "nl-bw-contracts",
      warranty: "nl-bw-contracts",
      transfer: "nl-bw-contracts",
      termination: "nl-bw-contracts",
    },
  },
  lease: {
    "United States": {
      payment: "us-ca-civil-tenancy",
      term: "us-ca-civil-tenancy",
      termination: "us-ca-civil-tenancy",
      maintenance: "us-ca-civil-tenancy",
    },
    "United Kingdom": {
      payment: "uk-landlord-tenant-1954",
      term: "uk-landlord-tenant-1954",
      termination: "uk-landlord-tenant-1954",
      maintenance: "uk-landlord-tenant-1954",
      transfer: "uk-landlord-tenant-1954",
    },
    Germany: {
      payment: "de-bgb-contracts",
      term: "de-bgb-contracts",
      termination: "de-bgb-contracts",
      maintenance: "de-bgb-contracts",
      transfer: "de-bgb-contracts",
      subject: "de-bgb-contracts",
    },
    France: {
      payment: "fr-code-civil-contracts",
      term: "fr-code-civil-contracts",
      termination: "fr-code-civil-contracts",
      maintenance: "fr-code-civil-contracts",
      transfer: "fr-code-civil-contracts",
      subject: "fr-code-civil-contracts",
    },
    Netherlands: {
      payment: "nl-bw-contracts",
      term: "nl-bw-contracts",
      termination: "nl-bw-contracts",
      maintenance: "nl-bw-contracts",
      transfer: "nl-bw-contracts",
      subject: "nl-bw-contracts",
    },
  },
  employment: {
    "United States": {
      compensation: "us-flsa-wages",
      termination: "us-flsa-wages",
    },
    "United Kingdom": {
      compensation: "uk-employment-rights-1996",
      termination: "uk-employment-rights-1996",
    },
    Germany: {
      compensation: "de-bgb-contracts",
      termination: "de-bgb-contracts",
    },
    France: {
      compensation: "fr-code-civil-contracts",
      termination: "fr-code-civil-contracts",
    },
    Netherlands: {
      compensation: "nl-bw-contracts",
      termination: "nl-bw-contracts",
    },
  },
}

function legalContextForCategory(category: ProtectionCategory, dealType: string, jurisdiction?: Jurisdiction | null): LegalCitation | null {
  // Jurisdiction is context, never defaulted: missing, empty, or UNKNOWN
  // jurisdiction yields no legal context (honest NOT_FOUND downstream).
  // In particular, UNKNOWN must never resolve to Nigeria or any other country.
  if (!jurisdiction || !jurisdiction.country || jurisdiction.country.trim().length === 0) return null
  if (jurisdiction.country === "UNKNOWN") return null
  const effectiveJurisdiction = jurisdiction
  const nigeriaMap: Record<string, string> = {
    ownership: "ng-cama-s18-types-of-companies",
    transfer: "ng-cama-s140-transfer-of-shares",
    governance: "ng-cama-s240-directors-duties",
    vesting: "ng-cama-vesting-contractual",
    leaver: "ng-cama-vesting-contractual",
    liability: "ng-cama-s240-directors-duties",
    structure: "ng-cama-part3-llp-nature",
    contribution: "ng-partnership-contributions",
    profit: "ng-partnership-contributions",
    authority: "ng-cama-s744-llp-agreement",
    dissolution: "ng-cama-part3-llp-nature",
    confidentiality: "ng-cac-business-names",
    ip: "ng-cama-s22-capacity",
  }
  const usMap: Record<string, string> = {
    ownership: "us-delaware-dgcl-s102-certificate",
    transfer: "us-delaware-dgcl-s202-transfer-restriction",
    governance: "us-delaware-dgcl-s141-board",
    vesting: "us-federal-securities-vesting-contractual",
    leaver: "us-federal-securities-vesting-contractual",
    liability: "us-delaware-dgcl-s141-board",
    structure: "us-delaware-dgcl-s102-certificate",
    contribution: "us-delaware-dgcl-s102-certificate",
    profit: "us-delaware-dgcl-s102-certificate",
    authority: "us-delaware-dgcl-s141-board",
    dissolution: "us-delaware-dgcl-s102-certificate",
    ip: "us-delaware-dgcl-s102-certificate",
    confidentiality: "us-delaware-dgcl-s102-certificate",
  }
  const ukMap: Record<string, string> = {
    ownership: "uk-companies-act-s9-registration",
    transfer: "uk-companies-act-s544-transfer",
    governance: "uk-companies-act-s171-directors-duties",
    vesting: "uk-companies-act-s9-registration",
    leaver: "uk-companies-act-s9-registration",
    liability: "uk-companies-act-s171-directors-duties",
    structure: "uk-llp-act-2000-nature",
    contribution: "uk-llp-act-2000-nature",
    profit: "uk-llp-act-2000-nature",
    authority: "uk-llp-act-2000-nature",
    dissolution: "uk-llp-act-2000-nature",
    ip: "uk-companies-act-s9-registration",
    confidentiality: "uk-companies-act-s9-registration",
  }
  const euMap: Record<string, string> = {
    ownership: "eu-directive-company-law",
    transfer: "eu-directive-company-law",
    governance: "eu-directive-company-law",
    vesting: "eu-directive-company-law",
    leaver: "eu-directive-company-law",
    liability: "eu-directive-company-law",
    structure: "eu-directive-company-law",
    contribution: "eu-directive-company-law",
    profit: "eu-directive-company-law",
    authority: "eu-directive-company-law",
    dissolution: "eu-directive-company-law",
    ip: "eu-directive-company-law",
    confidentiality: "eu-directive-company-law",
  }

  let mapping: Record<string, string> = nigeriaMap
  if (effectiveJurisdiction.country === "United States") mapping = usMap
  else if (effectiveJurisdiction.country === "United Kingdom") mapping = ukMap
  else if (effectiveJurisdiction.country === "European Union") mapping = euMap
  else if (effectiveJurisdiction.country === "Nigeria" || effectiveJurisdiction.country === "Federal Republic of Nigeria") mapping = nigeriaMap
  else if (effectiveJurisdiction.country === "Testland") return null
  else return null // unsupported jurisdiction → no legal context, honest NOT_FOUND

  // Tier 2 deal types resolve through the Tier 2 grounding table, which is
  // dealType-aware: founder/partnership company law never grounds a sale,
  // lease, or employment finding.
  if (TIER2_DEAL_TYPES.has(dealType)) {
    const tier2Id = TIER2_LEGAL_CONTEXT[dealType]?.[effectiveJurisdiction.country]?.[category]
    if (!tier2Id) return null
    const tier2Source = INTERNATIONAL_LEGAL_CORPUS.find((s) => s.id === tier2Id)
    if (!tier2Source) return null
    // Region gate: a region-scoped source (e.g. California tenancy law)
    // grounds only its own region or a region-less country query — never a
    // different region (no California law in a New York lease).
    if (
      tier2Source.jurisdiction.region &&
      effectiveJurisdiction.region &&
      tier2Source.jurisdiction.region.toLowerCase() !== effectiveJurisdiction.region.toLowerCase()
    ) {
      return null
    }
    return citationFromSource(tier2Source)
  }

  // No cross-jurisdiction fallback: when the jurisdiction's map has no
  // entry for this category, the intent carries no legal context rather
  // than borrowing another jurisdiction's law (never Nigeria-into-US/UK/EU).
  const candidateId = mapping[category]
  if (!candidateId) return null
  const source = INTERNATIONAL_LEGAL_CORPUS.find((s) => s.id === candidateId)
  if (!source) return null
  void dealType
  return citationFromSource(source)
}

function variablesForCategory(category: ProtectionCategory, dealType: string): string[] {
  if (dealType === "founder") {
    switch (category) {
      case "ownership":
        return ["founder names", "ownership percentages", "company name"]
      case "vesting":
        return ["vesting period", "cliff", "acceleration terms"]
      case "ip":
        return ["company name", "IP scope"]
      case "roles":
        return ["founder roles/titles"]
      case "governance":
        return ["governance thresholds", "reserved matters", "deadlock mechanism"]
      case "leaver":
        return ["leaver definitions (good/bad)", "buyout price/mechanics"]
      case "transfer":
        return ["transfer consent mechanism"]
      case "liability":
        return ["liability cap amount"]
      default:
        return []
    }
  }
  if (dealType === "partnership") {
    switch (category) {
      case "contribution":
        return ["partner names", "contribution amounts", "contribution timing"]
      case "ownership":
        return ["partner names", "ownership/profit percentages"]
      case "profit":
        return ["profit allocation", "distribution timing"]
      case "authority":
        return ["managing partner", "authority to bind"]
      case "governance":
        return ["voting thresholds", "reserved matters"]
      case "exit":
        return ["exit/buyout valuation method"]
      case "transfer":
        return ["transfer consent"]
      case "dissolution":
        return ["dissolution triggers", "winding-up process"]
      case "structure":
        return ["partnership structure (ordinary/LLP/LP/company)"]
      case "liability":
        return ["liability allocation"]
      default:
        return []
    }
  }
  if (dealType === "purchase_sale") {
    switch (category) {
      case "payment":
        return ["purchase price", "currency", "payment timing"]
      case "subject":
        return ["asset description", "quantity/condition"]
      case "delivery":
        return ["completion/delivery date", "handover mechanics"]
      case "transfer":
        return ["title transfer trigger"]
      case "warranty":
        return ["inspection/acceptance window", "warranty scope"]
      case "termination":
        return ["cancellation rights", "deposit treatment"]
      case "liability":
        return ["liability cap amount"]
      default:
        return []
    }
  }
  if (dealType === "lease") {
    switch (category) {
      case "payment":
        return ["rent amount", "payment frequency", "deposit"]
      case "term":
        return ["lease term", "commencement date"]
      case "termination":
        return ["termination rights", "notice period"]
      case "maintenance":
        return ["maintenance responsibility", "repair cost allocation"]
      case "transfer":
        return ["subletting/assignment consent"]
      case "subject":
        return ["permitted use"]
      case "liability":
        return ["liability cap amount"]
      default:
        return []
    }
  }
  if (dealType === "employment") {
    switch (category) {
      case "compensation":
        return ["salary/wage", "currency", "pay frequency"]
      case "roles":
        return ["job title", "key duties"]
      case "term":
        return ["start date", "term/permanence", "probation terms"]
      case "termination":
        return ["termination grounds", "notice period"]
      case "liability":
        return ["liability cap amount"]
      default:
        return []
    }
  }
  return []
}

export function protectionIntentsFromFindings(dealType: string, findings: RuleResult[], jurisdiction?: Jurisdiction | null): ProtectionIntent[] {
  const intents: ProtectionIntent[] = []
  for (const r of findings) {
    if (r.status !== "FAIL" || !r.finding) continue
    const severity = r.finding.severity
    const category = categoryForRuleKey(r.ruleKey)
    const evidence = (r.finding.evidence ?? []) as Evidence[]
    const legalContext = legalContextForCategory(category, dealType, jurisdiction ?? null)
    const variables = variablesForCategory(category, dealType)
    intents.push({
      id: r.ruleKey,
      dealType,
      findingId: r.ruleKey,
      category,
      title: r.finding.summary.replace(/\.$/, ""),
      problem: r.finding.summary,
      recommendation: r.finding.guidance ?? "Clarify this term before signing.",
      rationale: rationaleForSeverity(severity),
      priority: priorityForSeverity(severity),
      evidence,
      legalContext,
      status: variables.length > 0 ? "needs_input" : "ready",
      variables,
    })
  }
  // Sort by priority: critical first, then important, then consider, then by ruleKey
  const order = { critical: 0, important: 1, consider: 2 } as const
  intents.sort((a, b) => order[a.priority] - order[b.priority] || a.id.localeCompare(b.id))
  return intents
}
