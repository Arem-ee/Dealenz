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
  it("curates no keys while no founder sources exist", () => {
    expect(FOUNDER_KNOWLEDGE_KEYS).toEqual([])
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
