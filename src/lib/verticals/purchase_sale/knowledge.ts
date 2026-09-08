// Purchase/sale vertical knowledge hooks (Phase 13).
//
// No separate store, no second resolver. Curated knowledge keys relevant to
// purchase/sale deals (currently none: the production corpus holds no
// purchase/sale-specific sources, and that absence is represented as absence),
// plus a filter over shared resolver output. When purchase/sale-applicable
// items are curated, their keys get added here; resolution still flows through
// Context to Knowledge Resolver to Candidates.

import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"

// Curated knowledge keys relevant to purchase/sale deals. Empty until real
// purchase/sale sources are ingested. Never synthetic lookalikes.
export const PURCHASE_SALE_KNOWLEDGE_KEYS: readonly string[] = []

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
