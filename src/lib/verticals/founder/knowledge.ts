// Founder vertical knowledge hooks (Phase 22).
//
// No separate store, no second resolver. Curated knowledge keys relevant to
// founder deals (currently none: the production corpus holds no
// founder-specific sources, and that absence is represented as absence),
// plus a filter over shared resolver output. When founder-applicable items
// are curated, their keys get added here; resolution still flows through
// Context to Knowledge Resolver to Candidates.

import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"

// Curated knowledge keys relevant to founder deals. Phase 27 seeds
// Nigeria founder items; add new itemKeys here as verified sources are
// ingested. Never synthetic lookalikes.
export const FOUNDER_KNOWLEDGE_KEYS: readonly string[] = [
  "ng-cama-s18-types-of-companies",
  "ng-cama-s140-transfer-of-shares",
  "ng-cama-s240-directors-duties",
  "ng-cama-part3-llp-nature",
  "ng-cac-business-names",
]

// Narrows resolved candidates to founder-relevant ones: items that are
// unconstrained by deal type, items scoped to founder, and explicitly
// curated keys. Pure filter over resolver output; it never re-resolves.
export function selectFounderCandidates(candidates: KnowledgeCandidate[]): KnowledgeCandidate[] {
  return candidates.filter(
    (c) =>
      FOUNDER_KNOWLEDGE_KEYS.includes(c.itemKey) ||
      c.applicabilityDealTypes === undefined ||
      c.applicabilityDealTypes.includes("founder")
  )
}
