import { describe, it, expect } from "vitest"
import { EMPLOYMENT_KNOWLEDGE_KEYS, selectEmploymentCandidates } from "./knowledge"
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

describe("employment knowledge hooks", () => {
  it("curates verified employment keys (migration 00038, US/UK/DE/FR/NL)", () => {
    expect(EMPLOYMENT_KNOWLEDGE_KEYS).toContain("us-flsa-wages")
    expect(EMPLOYMENT_KNOWLEDGE_KEYS).toContain("uk-employment-rights-1996")
    expect(EMPLOYMENT_KNOWLEDGE_KEYS).toContain("de-bgb-contracts")
    expect(EMPLOYMENT_KNOWLEDGE_KEYS).toContain("fr-code-civil-contracts")
    expect(EMPLOYMENT_KNOWLEDGE_KEYS).toContain("nl-bw-contracts")
    for (const key of EMPLOYMENT_KNOWLEDGE_KEYS) {
      expect(key).toMatch(/^(us|uk|eu|de|fr|nl)-/)
    }
  })

  it("keeps unconstrained and employment-scoped candidates, drops others", () => {
    const kept = selectEmploymentCandidates([
      candidate({ itemKey: "a", applicabilityDealTypes: undefined }),
      candidate({ itemKey: "b", applicabilityDealTypes: ["employment"] }),
    ])
    expect(kept.map((c) => c.itemKey)).toEqual(["a", "b"])
    expect(
      selectEmploymentCandidates([candidate({ itemKey: "c", applicabilityDealTypes: ["freelance"] })])
    ).toEqual([])
  })

  it("never invents candidates from an empty resolution", () => {
    expect(selectEmploymentCandidates([])).toEqual([])
  })
})
