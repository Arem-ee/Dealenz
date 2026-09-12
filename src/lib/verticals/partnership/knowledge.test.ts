import { describe, it, expect } from "vitest"
import { PARTNERSHIP_KNOWLEDGE_KEYS, selectPartnershipCandidates } from "./knowledge"
import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"

function candidate(overrides: Partial<KnowledgeCandidate> = {}): KnowledgeCandidate {
  return {
    knowledgeItemId: "k1",
    itemKey: "test-item",
    version: 1,
    title: "Test item",
    kind: "industry_standard",
    authority: "industry_practice",
    relevance: 0.5,
    applicabilityReasons: [],
    effectiveFrom: "2020-01-01",
    effectiveTo: null,
    sourceName: "Test",
    sourceReference: "Ref",
    jurisdiction: "global",
    ...overrides,
  }
}

describe("partnership knowledge hooks", () => {
  it("curates Nigeria partnership keys (business-owner priority, not empty)", () => {
    expect(PARTNERSHIP_KNOWLEDGE_KEYS.length).toBeGreaterThanOrEqual(5)
    expect(PARTNERSHIP_KNOWLEDGE_KEYS).toContain("ng-cac-business-names")
    expect(PARTNERSHIP_KNOWLEDGE_KEYS).toContain("ng-partnership-contributions")
    for (const k of PARTNERSHIP_KNOWLEDGE_KEYS) expect(k.startsWith("ng-")).toBe(true)
    expect(new Set(PARTNERSHIP_KNOWLEDGE_KEYS).size).toBe(PARTNERSHIP_KNOWLEDGE_KEYS.length)
  })

  it("keeps unconstrained and partnership-scoped candidates, drops others", () => {
    const kept = selectPartnershipCandidates([
      candidate({ itemKey: "a" }),
      candidate({ itemKey: "b", applicabilityDealTypes: ["partnership"] }),
      candidate({ itemKey: "c", applicabilityDealTypes: ["lease"] }),
    ])
    expect(kept.map((c) => c.itemKey).sort()).toEqual(["a", "b"])
  })

  it("never invents candidates from an empty resolution", () => {
    expect(selectPartnershipCandidates([])).toEqual([])
  })
})
