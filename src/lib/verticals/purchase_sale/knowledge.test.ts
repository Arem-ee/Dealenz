import { describe, it, expect } from "vitest"
import { PURCHASE_SALE_KNOWLEDGE_KEYS, selectPurchaseSaleCandidates } from "./knowledge"
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

describe("purchase/sale knowledge hooks", () => {
  it("curates verified purchase/sale keys (migration 00038, US/UK/EU/DE/FR/NL)", () => {
    expect(PURCHASE_SALE_KNOWLEDGE_KEYS).toContain("us-ucc-article2-sale")
    expect(PURCHASE_SALE_KNOWLEDGE_KEYS).toContain("uk-sale-goods-1979")
    expect(PURCHASE_SALE_KNOWLEDGE_KEYS).toContain("eu-sale-goods-directive-2019-771")
    expect(PURCHASE_SALE_KNOWLEDGE_KEYS).toContain("de-bgb-contracts")
    expect(PURCHASE_SALE_KNOWLEDGE_KEYS).toContain("fr-code-civil-contracts")
    expect(PURCHASE_SALE_KNOWLEDGE_KEYS).toContain("nl-bw-contracts")
    for (const key of PURCHASE_SALE_KNOWLEDGE_KEYS) {
      expect(key).toMatch(/^(us|uk|eu|de|fr|nl)-/)
    }
  })

  it("keeps unconstrained and purchase_sale-scoped candidates, drops others", () => {
    const kept = selectPurchaseSaleCandidates([
      candidate({ itemKey: "a", applicabilityDealTypes: undefined }),
      candidate({ itemKey: "b", applicabilityDealTypes: ["purchase_sale"] }),
    ])
    expect(kept.map((c) => c.itemKey)).toEqual(["a", "b"])
    expect(
      selectPurchaseSaleCandidates([candidate({ itemKey: "c", applicabilityDealTypes: ["freelance"] })])
    ).toEqual([])
  })

  it("never invents candidates from an empty resolution", () => {
    expect(selectPurchaseSaleCandidates([])).toEqual([])
  })
})
