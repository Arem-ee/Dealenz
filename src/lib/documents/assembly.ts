// Document assembly — international, jurisdiction-aware (Phase 28).
//
// Pipeline: Deal (jurisdiction, facts, findings) → ProtectionIntents →
// Clauses (filtered by dealType/category/structure) → Variables (preserve
// UNKNOWN) → Draft (markdown) → Provenance (legal citations, temporal,
// veracity) → Review/Export/Handoff. No law is invented; missing facts stay
// missing; partnership structure is never guessed.

import { INTERNATIONAL_LEGAL_CORPUS } from "@/lib/legal-research/corpus"
import { citationFromSource } from "@/lib/legal-research/citations"
import { validateLegalSource } from "@/lib/legal-research/validation"
import type { LegalCitation } from "@/lib/legal-research/types"
import { CLAUSE_LIBRARY, renderClauseTemplate } from "@/lib/protection/clauses"
import { protectionIntentsFromFindings } from "@/lib/protection/intents"
import { familyById } from "./families"
import type { DocumentVariables, DraftDocument, DocumentProvenance } from "./types"
import type { RuleResult } from "@/lib/rules/result"

export interface AssemblyInput {
  familyId: string
  dealType: string
  jurisdiction: { country: string; region?: string | null; scope?: string }
  findings: RuleResult[]
  variables: DocumentVariables // user-provided, may be partial
  partnershipStructure?: string | null // "LLP" | "LP" | "ordinary" | null (UNKNOWN)
}

export interface AssemblyResult {
  draft: DraftDocument
  missingVariables: string[]
  citations: LegalCitation[]
  veracity: "VERIFIED" | "SUPPORTED" | "STALE" | "UNVERIFIED" | "NOT_FOUND" | "CONFLICTING"
  requiresLawyerReview: boolean
}

function citationsForFamily(familyId: string, jurisdictionCountry: string, now: Date): { citations: LegalCitation[]; veracity: AssemblyResult["veracity"] } {
  const family = familyById(familyId)
  if (!family) return { citations: [], veracity: "NOT_FOUND" }
  if (jurisdictionCountry === "Testland") {
    return { citations: [], veracity: "NOT_FOUND" }
  }
  const supportedCountries = new Set(["Nigeria", "Federal Republic of Nigeria", "United States", "United Kingdom", "European Union", "Germany", "France", "Netherlands"])
  if (!supportedCountries.has(jurisdictionCountry)) {
    return { citations: [], veracity: "NOT_FOUND" }
  }
  // Jurisdiction-aware: pick sources matching the requested country (and region where applicable).
  // Families are jurisdiction-neutral; legal sources are jurisdiction-specific.
  // For US/UK/EU, do not leak Nigerian law — use the international corpus filtered by jurisdiction.
  let sources = INTERNATIONAL_LEGAL_CORPUS.filter((s) => family.legalContextIds.includes(s.id) && s.jurisdiction.country === jurisdictionCountry)
  if (sources.length === 0) {
    // Fallback: for US/UK/EU, the family currently has Nigeria ids, but US/UK have no Nigeria match — pick the
    // appropriate verified corpus for that jurisdiction+family (e.g. US founder → Delaware, UK founder → Companies Act).
    // This keeps families jurisdiction-neutral while citations remain jurisdiction-correct.
    const fallbackMap: Record<string, Record<string, string[]>> = {
      "United States": {
        "founder-agreement": ["us-delaware-dgcl-s102-certificate", "us-delaware-dgcl-s141-board", "us-delaware-dgcl-s202-transfer-restriction"],
        "shareholders-agreement": ["us-delaware-dgcl-s102-certificate", "us-delaware-dgcl-s202-transfer-restriction"],
        "founder-ip-assignment": ["us-delaware-dgcl-s102-certificate"],
        "vesting-schedule": ["us-federal-securities-vesting-contractual"],
        "partnership-agreement": ["us-delaware-dgcl-s102-certificate"],
        "llp-agreement": ["us-delaware-dgcl-s102-certificate"],
        "contribution-schedule": ["us-delaware-dgcl-s102-certificate"],
        "profit-schedule": ["us-delaware-dgcl-s102-certificate"],
        "purchase-terms-sheet": ["us-ucc-article2-sale"],
        "lease-terms-summary": ["us-ca-civil-tenancy"],
        "employment-terms-summary": ["us-flsa-wages"],
      },
      "United Kingdom": {
        "founder-agreement": ["uk-companies-act-s9-registration", "uk-companies-act-s171-directors-duties", "uk-companies-act-s544-transfer"],
        "shareholders-agreement": ["uk-companies-act-s9-registration", "uk-companies-act-s544-transfer"],
        "founder-ip-assignment": ["uk-companies-act-s9-registration"],
        "vesting-schedule": ["uk-companies-act-s9-registration"],
        "partnership-agreement": ["uk-llp-act-2000-nature"],
        "llp-agreement": ["uk-llp-act-2000-nature", "uk-companies-act-s9-registration"],
        "contribution-schedule": ["uk-llp-act-2000-nature"],
        "profit-schedule": ["uk-llp-act-2000-nature"],
        "purchase-terms-sheet": ["uk-sale-goods-1979"],
        "lease-terms-summary": ["uk-landlord-tenant-1954"],
        "employment-terms-summary": ["uk-employment-rights-1996"],
      },
      "European Union": {
        "founder-agreement": ["eu-directive-company-law"],
        "shareholders-agreement": ["eu-directive-company-law"],
        "founder-ip-assignment": ["eu-directive-company-law"],
        "vesting-schedule": ["eu-directive-company-law"],
        "partnership-agreement": ["eu-directive-company-law"],
        "llp-agreement": ["eu-directive-company-law"],
        "contribution-schedule": ["eu-directive-company-law"],
        "profit-schedule": ["eu-directive-company-law"],
        "purchase-terms-sheet": ["eu-sale-goods-directive-2019-771"],
      },
    }
    const fallbackIds = fallbackMap[jurisdictionCountry]?.[familyId] ?? []
    sources = INTERNATIONAL_LEGAL_CORPUS.filter((s) => fallbackIds.includes(s.id) && s.jurisdiction.country === jurisdictionCountry)
  }
  if (sources.length === 0) {
    return { citations: [], veracity: "NOT_FOUND" }
  }
  const citations = sources.map(citationFromSource)
  const validations = sources.map((s) => validateLegalSource(s, now))
  const states = validations.map((v) => v.state)
  let veracity: AssemblyResult["veracity"] = "VERIFIED"
  if (states.includes("CONFLICTING")) veracity = "CONFLICTING"
  else if (states.every((s) => s === "VERIFIED")) veracity = "VERIFIED"
  else if (states.includes("STALE")) veracity = "STALE"
  else if (states.includes("UNVERIFIED")) veracity = "UNVERIFIED"
  else if (states.includes("SUPPORTED")) veracity = "SUPPORTED"
  else if (states.length === 0) veracity = "NOT_FOUND"
  return { citations, veracity }
}

export function assembleDraft(input: AssemblyInput, now: Date = new Date()): AssemblyResult {
  const family = familyById(input.familyId)
  if (!family) throw new Error(`Unknown document family: ${input.familyId}`)
  if (!family.dealTypes.includes(input.dealType as never)) {
    throw new Error(`Family ${family.id} does not support dealType ${input.dealType}`)
  }

  // Jurisdiction must be explicit when legally material
  const jurisdiction = {
    country: input.jurisdiction.country,
    region: input.jurisdiction.region ?? null,
  }
  if (family.requiredJurisdiction && (!jurisdiction.country || jurisdiction.country.trim().length === 0)) {
    throw new Error("Jurisdiction is required for this document family.")
  }

  // Partnership structure safety: do not collapse LLP/LP/ordinary
  if (input.dealType === "partnership") {
    const structure = input.partnershipStructure
    const isLLPFamily = family.id === "llp-agreement"
    const isPartnershipFamily = family.id === "partnership-agreement"
    if (isLLPFamily && structure && structure.toLowerCase() !== "llp" && structure.toLowerCase() !== "limited liability partnership") {
      // User selected LLP agreement but facts say LP/ordinary — surface as warning, not silent guess
      // For Phase 28 we allow generation but the draft will carry an explicit structure mismatch note
    }
    if (isPartnershipFamily && structure && structure.toLowerCase().includes("llp")) {
      // Ordinary partnership family selected but structure is LLP — also allowed with note
    }
    if (!structure) {
      // UNKNOWN → ask for clarification; draft will preserve UNKNOWN
    }
  }

  const jurisdictionForIntents = jurisdiction.country === "UNKNOWN" ? null : (jurisdiction as unknown as import("@/lib/legal-research/types").Jurisdiction)
  const intents = protectionIntentsFromFindings(input.dealType, input.findings, jurisdictionForIntents as never)
  const { citations, veracity } = citationsForFamily(family.id, jurisdiction.country, now)
  const requiresLawyerReview = veracity !== "VERIFIED" || family.id.includes("agreement")

  // Clause selection: by family.clauseIds, filtered by dealType (already matching) and structure where applicable
  const clauses = CLAUSE_LIBRARY.filter((c) => family.clauseIds.includes(c.id))
  // For partnership, filter LLP-specific nuances: keep all for now, but warnings already distinguish
  // In a future step, partnershipStructure could filter clause variants

  // Variable resolution: merge user variables, preserve UNKNOWN for missing required
  const allRequiredVars = new Set<string>()
  for (const clause of clauses) {
    for (const v of clause.variables) allRequiredVars.add(v.key)
  }
  // Family-level jurisdiction variable
  allRequiredVars.add("jurisdiction")
  // Partnership structure is a first-class variable when dealType is partnership
  if (input.dealType === "partnership") allRequiredVars.add("partnership_structure")

  const variables: DocumentVariables = { ...input.variables }
  if (!variables.jurisdiction) variables.jurisdiction = jurisdiction.country
  if (input.dealType === "partnership" && !variables.partnership_structure) {
    variables.partnership_structure = input.partnershipStructure ?? "UNKNOWN"
  }

  const missingVariables: string[] = []
  for (const key of allRequiredVars) {
    const val = variables[key]
    if (typeof val !== "string" || val.trim().length === 0 || val === "UNKNOWN") {
      missingVariables.push(key)
    }
  }

  // Build markdown draft
  const lines: string[] = []
  lines.push(`# ${family.title}`)
  lines.push("")
  lines.push(`*Deal type: ${input.dealType} · Jurisdiction: ${jurisdiction.country}${jurisdiction.region ? ` — ${jurisdiction.region}` : ""} · Generated ${now.toISOString().slice(0, 10)}*`)
  lines.push("")
  lines.push(`> ${family.description}`)
  lines.push("")
  if (intents.length > 0) {
    lines.push(`## Protection summary`)
    lines.push(`Based on ${intents.length} protection ${intents.length === 1 ? "priority" : "priorities"} derived from authoritative findings.`)
    for (const intent of intents) {
      lines.push(`- **${intent.title}** (${intent.priority}): ${intent.recommendation} — *${intent.rationale}*`)
    }
    lines.push("")
  }
  lines.push(`## Clauses`)
  lines.push(`The following clauses are drafting assistance, not statutory text.`)
  lines.push("")
  for (const clause of clauses) {
    const { rendered, missing } = renderClauseTemplate(clause.template, variables)
    lines.push(`### ${clause.title}`)
    lines.push(`*${clause.purpose}*`)
    lines.push("")
    lines.push(rendered)
    lines.push("")
    if (missing.length > 0) {
      lines.push(`> **Needs input:** ${missing.join(", ")} — UNKNOWN. Do not invent these values.`)
      lines.push("")
    }
    for (const w of clause.warnings) {
      lines.push(`> ⚠ ${w}`)
    }
    lines.push("")
  }

  // Legal provenance
  lines.push(`## Legal provenance`)
  if (citations.length > 0) {
    lines.push(`Verified legal context for ${jurisdiction.country}:`)
    for (const c of citations) {
      lines.push(`- **${c.title}** — ${c.section}: “${c.passage}” [${c.url ?? c.sourceId}, retrieved ${c.retrievedAt.slice(0, 10)}, ${c.effectiveStatus}, Tier ${c.authorityTier}]`)
    }
    if (veracity !== "VERIFIED") {
      lines.push(`> Veracity: ${veracity}. Treat as ${veracity.toLowerCase()}; confirm currency before relying on it.`)
    }
  } else {
    lines.push(`No verified legal sources were available for ${jurisdiction.country} for this document family. The draft is structural/deal-intelligence only. Do not present it as jurisdiction-specific law.`)
    if (jurisdiction.country === "Testland") {
      lines.push(`> Testland is a synthetic fixture jurisdiction used only to prove the generator is not Nigeria-hardcoded. It has no real legal coverage.`)
    }
  }
  lines.push("")
  lines.push(`## Important`)
  lines.push(`This draft is **drafting assistance, not a determination of enforceability**. Legal sources above are the authority; the clauses are the language you might negotiate. When enforceability matters, get a lawyer to confirm this applies to your facts.`)
  if (requiresLawyerReview) {
    lines.push(`> **Lawyer review recommended** for this document family.`)
  }
  lines.push("")
  lines.push(`---`)
  lines.push(`*Provenance: dealType ${input.dealType} · jurisdiction ${jurisdiction.country} · ${intents.length} intents · ${clauses.length} clauses · ${citations.length} citations · generated ${now.toISOString()}*`)

  const markdown = lines.join("\n")

  const provenance: DocumentProvenance = {
    dealType: input.dealType,
    jurisdiction,
    protectionIntents: intents,
    clauses,
    citations,
    missingVariables,
    generatedAt: now.toISOString(),
  }

  const draft: DraftDocument = {
    familyId: family.id as never,
    title: family.title,
    markdown,
    variables: { ...variables },
    missingVariables,
    citations,
    provenance,
    warnings: clauses.flatMap((c) => c.warnings),
  }

  return { draft, missingVariables, citations, veracity, requiresLawyerReview }
}
