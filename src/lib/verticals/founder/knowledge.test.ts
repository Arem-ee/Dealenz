import { describe, it, expect } from "vitest"
import { FOUNDER_KNOWLEDGE_KEYS, selectFounderCandidates } from "./knowledge"
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

describe("founder knowledge hooks", () => {
  it("curates Nigeria founder keys (business-owner priority, not empty)", () => {
    expect(FOUNDER_KNOWLEDGE_KEYS.length).toBeGreaterThanOrEqual(5)
    expect(FOUNDER_KNOWLEDGE_KEYS).toContain("ng-cama-s18-types-of-companies")
    expect(FOUNDER_KNOWLEDGE_KEYS).toContain("ng-cama-s140-transfer-of-shares")
    // All keys must be non-empty and prefixed with ng- for Nigeria scope
    for (const k of FOUNDER_KNOWLEDGE_KEYS) expect(k.startsWith("ng-")).toBe(true)
    expect(new Set(FOUNDER_KNOWLEDGE_KEYS).size).toBe(FOUNDER_KNOWLEDGE_KEYS.length)
  })

  it("keeps unconstrained and founder-scoped candidates, drops others", () => {
    const kept = selectFounderCandidates([
      candidate({ itemKey: "a" }),
      candidate({ itemKey: "b", applicabilityDealTypes: ["founder"] }),
      candidate({ itemKey: "c", applicabilityDealTypes: ["lease"] }),
    ])
    expect(kept.map((c) => c.itemKey).sort()).toEqual(["a", "b"])
  })

  it("never invents candidates from an empty resolution", () => {
    expect(selectFounderCandidates([])).toEqual([])
  })
})
