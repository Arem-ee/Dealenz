// Deterministic deal analysis — no AI, no network, no wall clock except
// the explicit evaluatedAt callers pass in. Raw material plus the deal
// type's rule pack yields evidence-backed findings grounded in the input
// text itself (audit_input source → EXACT offsets where matched).
//
// This is slice two of the workspace: analysis runs automatically on
// material. No approval gate — gates guard side effects (send, sign,
// publish, batch, overage), never reading.

import type { ExtractedData } from "@/lib/ai/extract"
import { seedEnvelopeForDealType } from "@/lib/context/schema"
import type { DealType } from "@/lib/context/schema"
import { attachEvidence } from "@/lib/evidence/collect"
import { evaluateApplicableRules } from "@/lib/rules/registry"
import type { RuleInput } from "@/lib/rules/schema"
import type { RuleResult } from "@/lib/rules/result"
import { verticalForDealType } from "@/lib/verticals"
import { deriveGenericFacts } from "@/lib/verticals/generic/facts"
import { registerGenericPack } from "@/lib/verticals/generic/rules"

export interface AnalysisOutput {
  results: RuleResult[]
  fails: RuleResult[]
  unknowns: RuleResult[]
  evaluatedAt: string
}

// Empty extraction stub: no AI ran, so structured fields stay empty and
// the raw text carries every observation. Confidence 0 marks provenance.
function emptyExtraction(): ExtractedData {
  return {
    goals: [],
    deliverables: [],
    timeline: null,
    budget: null,
    projectType: null,
    clientSignals: [],
    missingInformation: [],
    confidence: 0,
    budgetTerms: [],
    timelineTerms: [],
  } as unknown as ExtractedData
}

const KNOWN_DEAL_TYPES = ["freelance", "lease", "purchase_sale", "employment", "generic", "founder", "partnership"] as const

export function analyzeDeterministic(
  dealType: string,
  rawText: string,
  auditId: string,
  evaluatedAt: string
): AnalysisOutput {
  const key = (KNOWN_DEAL_TYPES as readonly string[]).includes(dealType) ? dealType : "generic"
  const pack = verticalForDealType(key) ?? {
    deriveFacts: deriveGenericFacts,
    registerPack: registerGenericPack,
    selectCandidates: () => [],
    key: "generic" as const,
  }
  pack.registerPack()

  const facts = pack.deriveFacts(emptyExtraction(), rawText, { type: "audit_input", id: auditId })
  const input: RuleInput = {
    context: seedEnvelopeForDealType(key as DealType),
    facts: facts as unknown as Record<string, unknown>,
    knowledge: [],
    operation: "document_analysis",
    evaluatedAt,
  }
  const run = evaluateApplicableRules(input, "document_analysis", key)
  const results = attachEvidence(run.results, input, "document_analysis", key)
  return {
    results,
    fails: results.filter((r) => r.status === "FAIL"),
    unknowns: results.filter((r) => r.status === "UNKNOWN"),
    evaluatedAt: run.evaluatedAt,
  }
}

export function summarizeAnalysis(output: AnalysisOutput): string {
  const { fails, unknowns } = output
  if (fails.length === 0 && unknowns.length === 0) {
    return "Analysis complete: no risky patterns found in this material."
  }
  const sev = (s: string) => fails.filter((f) => f.finding?.severity === s).length
  const parts: string[] = []
  const critical = sev("critical")
  const material = sev("material")
  const attention = sev("attention")
  if (critical > 0) parts.push(`${critical} critical`)
  if (material > 0) parts.push(`${material} material`)
  if (attention > 0) parts.push(`${attention} attention`)
  const found = parts.length > 0 ? parts.join(", ") : `${fails.length} finding${fails.length === 1 ? "" : "s"}`
  const unknownBit = unknowns.length > 0 ? ` · ${unknowns.length} need${unknowns.length === 1 ? "s" : ""} more context` : ""
  return `Analysis complete: ${found}${unknownBit}. Review each on the right.`
}
