import { describe, it, expect } from "vitest"
import { LEASE_KNOWLEDGE_KEYS, selectLeaseCandidates } from "./knowledge"
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
    jurisdiction: "global",
    ...overrides,
  }
}

describe("lease knowledge hooks", () => {
  it("curates no keys while no lease sources exist", () => {
    expect(LEASE_KNOWLEDGE_KEYS).toEqual([])
  })

  it("keeps unconstrained and lease-scoped candidates, drops others", () => {
    const kept = selectLeaseCandidates([
      candidate({ itemKey: "a", applicabilityDealTypes: undefined }),
      candidate({ itemKey: "b", applicabilityDealTypes: ["lease"] }),
    ])
    expect(kept.map((c) => c.itemKey)).toEqual(["a", "b"])
    expect(
      selectLeaseCandidates([candidate({ itemKey: "c", applicabilityDealTypes: ["freelance"] })])
    ).toEqual([])
  })

  it("never invents candidates from an empty resolution", () => {
    expect(selectLeaseCandidates([])).toEqual([])
  })
})
