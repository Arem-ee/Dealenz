// Deterministic applicability evaluation (Phase 5C).
//
// Decides whether a Knowledge Item is a *candidate* for a resolved context —
// a contextual match, never a legal conclusion. Hard gates (status handled by
// the caller, effective dates, jurisdiction, known deal-type mismatch) decide
// eligibility; soft dimensions contribute relevance points plus human-readable
// reasons. Unknown context never disqualifies: it yields an explicit
// "unverified" reason instead, deferring to human judgment.

import type { ContextEnvelope } from "@/lib/context/schema"
import type { KnowledgeItem } from "./schema"

export interface ApplicabilityEvaluation {
  eligible: boolean
  // 0-1. Meaning: "the resolver believes this item is relevant to the supplied
  // context." NOT a probability that the item legally applies.
  relevance: number
  reasons: string[]
}

function normalizePlace(value: string): string {
  return value.trim().toLowerCase()
}

// Jurisdiction match is a normalized code equality check (or global scope).
// This is a routing heuristic, not a conflicts-of-law analysis.
export function jurisdictionMatches(item: KnowledgeItem, contextJurisdiction: string | null): boolean {
  if (item.jurisdiction.scope === "global") return true
  if (contextJurisdiction === null) return false
  return normalizePlace(item.jurisdiction.code as string) === normalizePlace(contextJurisdiction)
}

function dealTypeOf(envelope: ContextEnvelope): "freelance" | "generic" | "lease" | null {
  const field = envelope.fields.dealType
  if (field.source === "unknown" || field.value === null) return null
  return field.value
}

function knownValue<T>(value: T | null, source: string): T | null {
  return source === "unknown" || value === null ? null : value
}

export function evaluateApplicability(item: KnowledgeItem, envelope: ContextEnvelope): ApplicabilityEvaluation {
  const reasons: string[] = []
  const app = item.applicability

  const jurisdictionValue = knownValue(envelope.fields.jurisdiction.value, envelope.fields.jurisdiction.source)
  if (!jurisdictionMatches(item, jurisdictionValue)) {
    return {
      eligible: false,
      relevance: 0,
      reasons: [`jurisdiction does not match (${item.jurisdiction.scope}${item.jurisdiction.code ? `: ${item.jurisdiction.code}` : ""})`],
    }
  }
  reasons.push(
    item.jurisdiction.scope === "global"
      ? "applies across jurisdictions (global scope)"
      : `jurisdiction matches ${item.jurisdiction.code}`
  )

  const dealType = dealTypeOf(envelope)
  if (app.dealTypes && app.dealTypes.length > 0) {
    if (dealType === null) {
      reasons.push("deal type not yet resolved — verify before relying on this item")
    } else if (!app.dealTypes.includes(dealType)) {
      return { eligible: false, relevance: 0, reasons: [`deal type ${dealType} is outside this item's scope`] }
    } else {
      reasons.push(`deal type ${dealType} is within scope`)
    }
  }

  let relevance = 0.4
  const matched: Array<[string, boolean, string]> = []
  const industry = knownValue(envelope.fields.industry.value, envelope.fields.industry.source)
  const structure = knownValue(envelope.fields.transactionStructure.value, envelope.fields.transactionStructure.source)
  const stage = knownValue(envelope.fields.transactionStage.value, envelope.fields.transactionStage.source)
  const entityTypes = envelope.fields.entityTypes.source === "unknown" ? null : envelope.fields.entityTypes.value
  const regulated = knownValue(envelope.fields.regulatedIndustry.value, envelope.fields.regulatedIndustry.source)
  const crossBorder = knownValue(envelope.fields.crossBorder.value, envelope.fields.crossBorder.source)

  if (app.industries && app.industries.length > 0) {
    if (industry === null) matched.push(["industry", false, "industry not yet resolved — verify"])
    else if (app.industries.includes(industry)) matched.push(["industry", true, `industry ${industry} matches`])
    else return { eligible: true, relevance: 0.2, reasons: [...reasons, `industry ${industry} is outside this item's focus`] }
  }
  if (app.structures && app.structures.length > 0) {
    if (structure === null) matched.push(["structure", false, "deal structure not yet resolved — verify"])
    else if (app.structures.includes(structure)) matched.push(["structure", true, `structure ${structure} matches`])
    else return { eligible: true, relevance: 0.2, reasons: [...reasons, `structure ${structure} is outside this item's focus`] }
  }
  if (app.stages && app.stages.length > 0) {
    if (stage === null) matched.push(["stage", false, "deal stage not yet resolved — verify"])
    else if (app.stages.includes(stage)) matched.push(["stage", true, `stage ${stage} matches`])
  }
  if (app.entityTypes && app.entityTypes.length > 0) {
    if (entityTypes === null) matched.push(["entity types", false, "entity types not yet resolved — verify"])
    else if (entityTypes.some((e) => app.entityTypes!.includes(e))) {
      matched.push(["entity types", true, `entity overlap (${entityTypes.filter((e) => app.entityTypes!.includes(e)).join(", ")})`])
    }
  }
  if (app.regulatedOnly) {
    if (regulated === null) matched.push(["regulated industry", false, "regulated status not yet resolved — verify"])
    else if (regulated) matched.push(["regulated industry", true, "regulated context matches"])
    else return { eligible: true, relevance: 0.2, reasons: [...reasons, "item targets regulated contexts only"] }
  }
  if (app.crossBorderOnly) {
    if (crossBorder === null) matched.push(["cross-border", false, "cross-border status not yet resolved — verify"])
    else if (crossBorder) matched.push(["cross-border", true, "cross-border context matches"])
    else return { eligible: true, relevance: 0.2, reasons: [...reasons, "item targets cross-border contexts only"] }
  }

  for (const [, hit, reason] of matched) {
    reasons.push(reason)
    if (hit) relevance += 0.1
  }
  relevance = Math.min(1, Math.round(relevance * 100) / 100)
  return { eligible: true, relevance, reasons }
}
