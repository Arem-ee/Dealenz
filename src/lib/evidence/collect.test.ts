import { describe, it, expect, beforeEach } from "vitest"
import { attachEvidence, collectEvidenceForResult, knowledgeToEvidence } from "./collect"
import { makeEvidence } from "./schema"
import { evaluateRule } from "@/lib/rules/result"
import { clearRegistry, registerRule } from "@/lib/rules/registry"
import { testRule, testRuleInput } from "@/lib/rules/test-helpers"
import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"

beforeEach(() => {
  clearRegistry()
})

function evidenceRef(overrides: Record<string, unknown> = {}) {
  return makeEvidence({
    sourceType: "audit_input",
    sourceId: "audit-1",
    quote: "unlimited revisions until approval",
    observationKey: "facts.freelance.revisions",
    method: "pattern_observation",
    confidence: 0.8,
    inspectable: true,
    location: { kind: "approximate", section: "raw_input" },
    ...overrides,
  })
}

function candidate(overrides: Partial<KnowledgeCandidate> = {}): KnowledgeCandidate {
  return {
    knowledgeItemId: "k1",
    itemKey: "test-item",
    version: 2,
    title: "Test item",
    kind: "market_practice",
    authority: "market_practice",
    relevance: 0.72,
    applicabilityReasons: ["test"],
    effectiveFrom: "2020-01-01",
    effectiveTo: null,
    sourceName: "Test Source",
    sourceReference: "TEST-1",
    jurisdiction: "global",
    ...overrides,
  }
}

describe("evidence collection", () => {
  it("attaches fact evidence behind a fired rule", () => {
    const ref = evidenceRef()
    const rule = testRule({
      ruleKey: "budget-check",
      condition: { field: "facts.budget", op: "exists" },
      fireOn: true,
    })
    const input = testRuleInput({
      facts: { budget: { text: "$5000", evidence: "$5000", evidenceRefs: [ref] } },
    })
    const result = evaluateRule(rule, input)
    expect(result.status).toBe("FAIL")
    const collected = collectEvidenceForResult(result, rule, input)
    expect(collected).toHaveLength(1)
    expect(collected[0].id).toBe(ref.id)
  })

  it("resolves evidence through nested fact paths", () => {
    const ref = evidenceRef({ observationKey: "facts.freelance.fee" })
    const rule = testRule({
      ruleKey: "fee-check",
      condition: { field: "facts.freelance.fee.text", op: "exists" },
      fireOn: true,
    })
    const input = testRuleInput({
      facts: { freelance: { fee: { text: "$5k", evidence: "$5k", evidenceRefs: [ref] } } },
    })
    const collected = collectEvidenceForResult(evaluateRule(rule, input), rule, input)
    expect(collected.map((e) => e.id)).toEqual([ref.id])
  })

  it("attaches knowledge evidence for knowledgePresent conditions", () => {
    const item = candidate()
    const rule = testRule({
      ruleKey: "knowledge-check",
      category: "knowledge",
      condition: { knowledgePresent: { itemKey: "test-item" } },
      fireOn: true,
    })
    const input = testRuleInput({ knowledge: [item] })
    const collected = collectEvidenceForResult(evaluateRule(rule, input), rule, input)
    expect(collected).toHaveLength(1)
    expect(collected[0].sourceType).toBe("knowledge")
    expect(collected[0].sourceId).toBe("test-item")
    expect(collected[0].sourceVersion).toBe(2)
    // Provenance is referenced, never duplicated.
    expect(collected[0].quote).toBeNull()
  })

  it("returns nothing for PASS and UNKNOWN results", () => {
    const passingRule = testRule({ condition: { field: "facts.budget", op: "missing" }, fireOn: true })
    const passing = evaluateRule(passingRule, testRuleInput())
    expect(passing.status).toBe("PASS")
    expect(collectEvidenceForResult(passing, passingRule, testRuleInput())).toEqual([])
    const unknownRule = testRule({ condition: { field: "facts.budget", op: "eq", value: "$5000" }, fireOn: false })
    const unknown = evaluateRule(unknownRule, testRuleInput({ facts: {} }))
    expect(unknown.status).toBe("UNKNOWN")
    expect(collectEvidenceForResult(unknown, unknownRule, testRuleInput({ facts: {} }))).toEqual([])
  })

  it("skips malformed references instead of failing", () => {
    const rule = testRule({ condition: { field: "facts.budget", op: "exists" }, fireOn: true })
    const input = testRuleInput({
      facts: { budget: { text: "$5k", evidence: "$5k", evidenceRefs: [{ bogus: true }] } },
    })
    expect(collectEvidenceForResult(evaluateRule(rule, input), rule, input)).toEqual([])
  })

  it("deduplicates repeated references to the same evidence", () => {
    const ref = evidenceRef()
    const rule = testRule({
      ruleKey: "dup-check",
      condition: { all: [{ field: "facts.budget", op: "exists" }, { field: "facts.budget", op: "exists" }] },
      fireOn: true,
    })
    const input = testRuleInput({
      facts: { budget: { text: "$5k", evidence: "$5k", evidenceRefs: [ref] } },
    })
    expect(collectEvidenceForResult(evaluateRule(rule, input), rule, input)).toHaveLength(1)
  })
})

describe("knowledge evidence bridge", () => {
  it("preserves provenance by reference with deterministic ids", () => {
    const first = knowledgeToEvidence(candidate())
    const second = knowledgeToEvidence(candidate())
    expect(first.id).toBe(second.id)
    expect(first.method).toBe("knowledge_reference")
    expect(first.location.kind).toBe("unavailable")
    expect(first.confidence).toBe(0.72)
    expect(first.inspectable).toBe(true)
  })
})

describe("attachEvidence", () => {
  it("enriches FAIL findings and leaves other results untouched", () => {
    const ref = evidenceRef()
    const failing = testRule({
      ruleKey: "attach-fail",
      condition: { field: "facts.budget", op: "exists" },
      fireOn: true,
    })
    const passing = testRule({
      ruleKey: "attach-pass",
      condition: { field: "facts.budget", op: "missing" },
      fireOn: true,
    })
    registerRule(failing)
    registerRule(passing)
    const input = testRuleInput({
      facts: { budget: { text: "$5k", evidence: "$5k", evidenceRefs: [ref] } },
    })
    const results = [evaluateRule(failing, input), evaluateRule(passing, input)]
    const enriched = attachEvidence(results, input, "document_analysis", "freelance")
    expect(enriched).toHaveLength(2)
    expect(enriched[0].finding?.evidence?.map((e) => e.id)).toEqual([ref.id])
    expect(enriched[1].finding).toBeUndefined()
    expect("evidence" in enriched[1]).toBe(false)
    // Inputs are untouched (new objects returned).
    expect(results[0].finding).not.toHaveProperty("evidence")
  })

  it("leaves results unchanged when their rule is not registered", () => {
    const rule = testRule({ ruleKey: "ghost-rule", condition: { field: "facts.budget", op: "exists" }, fireOn: true })
    const input = testRuleInput({ facts: { budget: { text: "$5k", evidence: "$5k", evidenceRefs: [evidenceRef()] } } })
    const results = [evaluateRule(rule, input)]
    expect(results[0].status).toBe("FAIL")
    const enriched = attachEvidence(results, input, "document_analysis", "freelance")
    expect(enriched[0]).toEqual(results[0])
  })
})
