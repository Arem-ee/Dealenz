// Lawyer handoff package — Founder/Partnership contextual review (international-first).
//
// Consumes already-authoritative outputs (facts, findings, evidence, intents,
// clauses, document provenance, legal citations) — no re-analysis, no invented
// law, no guessed jurisdiction or structure. Missing stays UNKNOWN.

import type { RuleResult } from "@/lib/rules/result"
import type { ProtectionIntent } from "@/lib/protection/intents"
import type { ClauseTemplate } from "@/lib/protection/clauses"
import type { LegalCitation } from "@/lib/legal-research/types"
import type { DraftDocument } from "@/lib/documents/types"
import type { Evidence } from "@/lib/evidence/schema"

export interface HandoffDealRef {
  auditId: string
  dealType: string
  jurisdiction: { country: string; region?: string | null }
  title?: string | null
}

export interface HandoffFindingRef {
  ruleKey: string
  summary: string
  severity: string
  guidance?: string
  evidence: Evidence[]
  status: RuleResult["status"]
}

export interface HandoffPackage {
  deal: HandoffDealRef
  facts: Record<string, unknown> | null // vertical facts snapshot (if available)
  findings: HandoffFindingRef[] // deterministic, evidence-preserving
  risk: { overallScore: number | null; riskLevel: string | null } | null
  protectionIntents: ProtectionIntent[]
  clauses: ClauseTemplate[] // selected for the dealType/structure
  documentDraft: { familyId: string; title: string; markdown: string; missingVariables: string[] } | null
  legalCitations: LegalCitation[]
  evidence: Evidence[] // flattened, deduplicated by id
  missingInformation: string[] // e.g. jurisdiction UNKNOWN, partnership_structure UNKNOWN, ownership percentages
  generatedAt: string
  provenanceNote: string
}

export interface BuildHandoffInput {
  audit: { id: string; deal_type: string | null; title?: string | null; raw_input?: string | null }
  jurisdiction: { country: string; region?: string | null }
  facts: Record<string, unknown> | null
  findings: RuleResult[]
  riskReport: { overallScore?: number | null; riskLevel?: string | null } | null
  protectionIntents: ProtectionIntent[]
  clauses: ClauseTemplate[]
  draft: DraftDocument | null
  legalCitations: LegalCitation[]
}

export function buildHandoffPackage(input: BuildHandoffInput, now: Date = new Date()): HandoffPackage {
  const dealType = (input.audit.deal_type as string) ?? "unknown"
  const findings: HandoffFindingRef[] = input.findings
    .filter((r) => r.status === "FAIL" && r.finding)
    .slice(0, 20)
    .map((r) => ({
      ruleKey: r.ruleKey,
      summary: r.finding!.summary,
      severity: r.finding!.severity,
      guidance: r.finding!.guidance,
      evidence: (r.finding!.evidence ?? []) as Evidence[],
      status: r.status,
    }))

  // Deduplicate evidence by id
  const evidenceById = new Map<string, Evidence>()
  for (const f of findings) for (const e of f.evidence) evidenceById.set(e.id, e)
  for (const intent of input.protectionIntents) for (const e of intent.evidence) evidenceById.set(e.id, e)

  const missingInformation: string[] = []
  if (!input.jurisdiction.country || input.jurisdiction.country.trim().length === 0 || input.jurisdiction.country === "UNKNOWN") {
    missingInformation.push("jurisdiction")
  }
  // Surface missing variables from intents and draft
  for (const intent of input.protectionIntents) for (const v of intent.variables) if (!missingInformation.includes(v)) missingInformation.push(v)
  if (input.draft) for (const v of input.draft.missingVariables) if (!missingInformation.includes(v)) missingInformation.push(v)
  // Partnership structure UNKNOWN is already in variables, but surface explicitly
  if (dealType === "partnership") {
    const hasStructure = input.protectionIntents.some((i) => i.category === "structure") || input.clauses.some((c) => c.protectionCategories.includes("structure" as never))
    void hasStructure
    // If no structure fact was observed, it's already in missingInformation via clause variables
  }

  // Filter legal citations to the handoff's jurisdiction — do not leak Nigerian law into a UK/US handoff
  const filteredLegalCitations = input.legalCitations.filter((c) => c.jurisdiction === input.jurisdiction.country)

  return {
    deal: {
      auditId: input.audit.id,
      dealType,
      jurisdiction: { country: input.jurisdiction.country, region: input.jurisdiction.region ?? null },
      title: input.audit.title ?? null,
    },
    facts: input.facts,
    findings,
    risk: input.riskReport ? { overallScore: input.riskReport.overallScore ?? null, riskLevel: input.riskReport.riskLevel ?? null } : null,
    protectionIntents: input.protectionIntents,
    clauses: input.clauses,
    documentDraft: input.draft
      ? { familyId: input.draft.familyId, title: input.draft.title, markdown: input.draft.markdown, missingVariables: input.draft.missingVariables }
      : null,
    legalCitations: filteredLegalCitations,
    evidence: Array.from(evidenceById.values()),
    missingInformation,
    generatedAt: now.toISOString(),
    provenanceNote: "Built from existing Dealenz intelligence (facts, findings, evidence, intents, clauses, legal citations). No re-analysis. Draft clauses are drafting assistance, not a determination of enforceability.",
  }
}

export function validateHandoffPackage(pkg: HandoffPackage): { valid: boolean; reason?: string } {
  if (!pkg.deal.auditId) return { valid: false, reason: "Missing auditId" }
  if (!pkg.deal.dealType) return { valid: false, reason: "Missing dealType" }
  if (!pkg.deal.jurisdiction.country) return { valid: false, reason: "Missing jurisdiction" }
  // Founder/partnership isolation: clauses must match dealType
  for (const c of pkg.clauses) {
    if (!c.dealTypes.includes(pkg.deal.dealType as never)) {
      return { valid: false, reason: `Clause ${c.id} does not support dealType ${pkg.deal.dealType}` }
    }
  }
  // Findings must be FAIL only (no invented PASS→FAIL)
  for (const f of pkg.findings) {
    if (f.status !== "FAIL") return { valid: false, reason: `Finding ${f.ruleKey} is not FAIL` }
  }
  return { valid: true }
}
