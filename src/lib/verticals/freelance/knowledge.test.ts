import { describe, it, expect } from "vitest"
import { FREELANCE_KNOWLEDGE_KEYS, selectFreelanceCandidates } from "./knowledge"
import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"

function candidate(overrides: Partial<KnowledgeCandidate> = {}): KnowledgeCandidate {
  return {
    knowledgeItemId: "k1",
    itemKey: "test-item",
    version: 1,
    title: "Test item",
    kind: "market_practice",
    authority: "market_practice",
    relevance: 0.7,
    applicabilityReasons: ["test"],
    effectiveFrom: "2020-01-01",
    effectiveTo: null,
    sourceName: "synthetic-test-fixture",
    sourceReference: "TEST-X",
    ...overrides,
  }
}

describe("freelance knowledge hooks", () => {
  it("curates no keys while the store has no real freelance sources", () => {
    expect(FREELANCE_KNOWLEDGE_KEYS).toEqual([])
  })

  it("keeps unconstrained and freelance-scoped candidates, drops generic-only ones", () => {
    const kept = selectFreelanceCandidates([
      candidate({ itemKey: "a", applicabilityDealTypes: undefined }),
      candidate({ itemKey: "b", applicabilityDealTypes: ["freelance", "generic"] }),
    ])
    expect(kept.map((c) => c.itemKey)).toEqual(["a", "b"])
    const dropped = selectFreelanceCandidates([
      candidate({ itemKey: "c", applicabilityDealTypes: ["generic"] }),
    ])
    expect(dropped).toEqual([])
  })

  it("never invents candidates from an empty resolution", () => {
    expect(selectFreelanceCandidates([])).toEqual([])
  })
})
