// Partnership vertical knowledge hooks (Phase 25).
//
// No separate store, no second resolver. Curated knowledge keys relevant to
// partnership deals (currently none: the production corpus holds no
// partnership-specific sources, and that absence is represented as absence),
// plus a filter over shared resolver output. When partnership-applicable items
// are curated, their keys get added here; resolution still flows through
// Context to Knowledge Resolver to Candidates.

import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"

// Curated knowledge keys relevant to partnership deals. Phase 27 seeds
// Nigeria partnership items; add new itemKeys here as verified sources are
// ingested. Never synthetic lookalikes.
export const PARTNERSHIP_KNOWLEDGE_KEYS: readonly string[] = [
  "ng-cama-s18-types-of-companies",
  "ng-cama-part3-llp-nature",
  "ng-partnership-act-1890-application",
  "ng-cac-business-names",
  "ng-cama-s744-llp-agreement",
  "ng-partnership-contributions",
]

// Narrows resolved candidates to partnership-relevant ones: items that are
// unconstrained by deal type, items scoped to partnership, and explicitly
// curated keys. Pure filter over resolver output; it never re-resolves.
export function selectPartnershipCandidates(candidates: KnowledgeCandidate[]): KnowledgeCandidate[] {
  return candidates.filter(
    (c) =>
      PARTNERSHIP_KNOWLEDGE_KEYS.includes(c.itemKey) ||
      c.applicabilityDealTypes === undefined ||
      c.applicabilityDealTypes.includes("partnership")
  )
}
