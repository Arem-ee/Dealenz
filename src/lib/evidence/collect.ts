// Evidence collection for deterministic findings (Phase 7).
//
// After pure rule evaluation, this module answers "why did this rule fire?"
// without asking the LLM: it walks the fired rule's condition, resolves each
// referenced fact path against the evaluation input, and gathers the Evidence
// objects the projections attached there, plus knowledge evidence for
// knowledgePresent conditions. Pure and side-effect free like the evaluator.
// A finding with no evidence stays possible: absence of evidence is
// represented, never fabricated.

import { checkEvidence, evidenceId, type Evidence } from "./schema"
import { applicableRules } from "@/lib/rules/registry"
import type { AIOperation } from "@/lib/ai/operations"
import type { Condition, Rule, RuleInput } from "@/lib/rules/schema"
import type { RuleResult } from "@/lib/rules/result"
import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"

// Bridges shared knowledge provenance into the evidence abstraction without
// duplicating it: the evidence references the item (never copies its content)
// and reuses the resolver's relevance as method confidence.
export function knowledgeToEvidence(candidate: KnowledgeCandidate): Evidence {
  const observationKey = `knowledge:${candidate.itemKey}`
  return checkEvidence({
    id: evidenceId({
      source: `knowledge:${candidate.itemKey}`,
      key: observationKey,
      quote: "",
      location: `v${candidate.version}`,
    }),
    sourceType: "knowledge",
    sourceId: candidate.itemKey,
    sourceVersion: candidate.version,
    location: { kind: "unavailable" },
    quote: null,
    observationKey,
    method: "knowledge_reference",
    confidence: candidate.relevance,
    inspectable: true,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// Collects condition field paths and knowledge keys from a condition tree.
function collectConditionRefs(condition: Condition, fields: Set<string>, knowledgeKeys: Array<string | undefined>): void {
  if (!isRecord(condition)) return
  if (typeof condition.field === "string") {
    fields.add(condition.field)
    return
  }
  if (Array.isArray(condition.all)) {
    for (const sub of condition.all) collectConditionRefs(sub as Condition, fields, knowledgeKeys)
    return
  }
  if (Array.isArray(condition.any)) {
    for (const sub of condition.any) collectConditionRefs(sub as Condition, fields, knowledgeKeys)
    return
  }
  if (condition.not !== undefined) {
    collectConditionRefs(condition.not as Condition, fields, knowledgeKeys)
    return
  }
  if (isRecord(condition.knowledgePresent)) {
    const itemKey = (condition.knowledgePresent as Record<string, unknown>).itemKey
    knowledgeKeys.push(typeof itemKey === "string" ? itemKey : undefined)
  }
}

function resolvePath(root: unknown, path: string): unknown {
  const segments = path.split(".").filter((s) => s.length > 0)
  let current: unknown = root
  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) return undefined
    current = current[segment]
  }
  return current
}

// Evidence attached to an observed fact object ({ text|value, evidence,
// evidenceRefs }). Only validated Evidence objects are collected; anything
// malformed is skipped rather than propagated.
function evidenceAt(value: unknown): Evidence[] {
  if (!isRecord(value)) return []
  const refs = value.evidenceRefs
  if (!Array.isArray(refs)) return []
  const out: Evidence[] = []
  for (const ref of refs) {
    try {
      out.push(checkEvidence(ref))
    } catch {
      // Skip malformed references; never fail evaluation over evidence.
    }
  }
  return out
}

// Gathers supporting evidence for one evaluated rule result. FAIL results get
// the evidence behind the facts (and knowledge) the condition actually read.
// PASS and UNKNOWN results carry no evidence: there is nothing observed to
// point at, and absence must not be dressed up as support.
export function collectEvidenceForResult(result: RuleResult, rule: Rule, input: RuleInput): Evidence[] {
  if (result.status !== "FAIL") return []
  const fields = new Set<string>()
  const knowledgeKeys: Array<string | undefined> = []
  collectConditionRefs(rule.condition, fields, knowledgeKeys)

  const seen = new Set<string>()
  const out: Evidence[] = []
  const push = (evidence: Evidence) => {
    if (!seen.has(evidence.id)) {
      seen.add(evidence.id)
      out.push(evidence)
    }
  }

  for (const field of fields) {
    const value = resolvePath({ facts: input.facts, context: input.context }, field)
    // Facts live under facts.*; the observed object holding evidenceRefs may
    // be the terminal value itself or its parent (e.g. fee.text → fee).
    const candidates: unknown[] = [value]
    const segments = field.split(".").filter((s) => s.length > 0)
    if (segments.length > 1) {
      candidates.push(resolvePath({ facts: input.facts, context: input.context }, segments.slice(0, -1).join(".")))
    }
    for (const candidate of candidates) {
      for (const evidence of evidenceAt(candidate)) push(evidence)
    }
  }

  for (const itemKey of knowledgeKeys) {
    const matches = input.knowledge.filter((c) => itemKey === undefined || c.itemKey === itemKey)
    for (const candidate of matches) push(knowledgeToEvidence(candidate))
  }
  return out
}

// Enriches evaluated results with supporting evidence, returning new result
// objects (inputs untouched). Only FAIL findings gain an evidence field, and
// only when evidence was actually found. Pure: same results plus same input
// always yield the same enrichment.
export function attachEvidence(
  results: RuleResult[],
  input: RuleInput,
  operation: AIOperation,
  dealType: string
): RuleResult[] {
  const rules = new Map(applicableRules(operation, dealType).map((rule) => [rule.ruleKey, rule]))
  return results.map((result) => {
    if (result.status !== "FAIL" || !result.finding) return result
    const rule = rules.get(result.ruleKey)
    if (!rule) return result
    const evidence = collectEvidenceForResult(result, rule, input)
    if (evidence.length === 0) return result
    return { ...result, finding: { ...result.finding, evidence } }
  })
}
