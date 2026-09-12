// Purchase/sale vertical knowledge hooks (Phase 13).
//
// No separate store, no second resolver. Curated knowledge keys relevant to
// purchase/sale deals (currently none: the production corpus holds no
// purchase/sale-specific sources, and that absence is represented as absence),
// plus a filter over shared resolver output. When purchase/sale-applicable
// items are curated, their keys get added here; resolution still flows through
// Context to Knowledge Resolver to Candidates.

import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"

// Curated knowledge keys relevant to purchase/sale deals. Seeded by
// migration 00038 (US/UK/EU/DE/FR/NL sale-of-goods sources). Never synthetic
// lookalikes.
export const PURCHASE_SALE_KNOWLEDGE_KEYS: readonly string[] = [
  "us-ucc-article2-sale",
  "uk-sale-goods-1979",
  "eu-sale-goods-directive-2019-771",
  "de-bgb-contracts",
  "fr-code-civil-contracts",
  "nl-bw-contracts",
]

// Narrows resolved candidates to purchase/sale-relevant ones: items that are
// unconstrained by deal type, items scoped to purchase_sale, and explicitly
// curated keys. Pure filter over resolver output; it never re-resolves.
export function selectPurchaseSaleCandidates(candidates: KnowledgeCandidate[]): KnowledgeCandidate[] {
  return candidates.filter(
    (c) =>
      PURCHASE_SALE_KNOWLEDGE_KEYS.includes(c.itemKey) ||
      c.applicabilityDealTypes === undefined ||
      c.applicabilityDealTypes.includes("purchase_sale")
  )
}
