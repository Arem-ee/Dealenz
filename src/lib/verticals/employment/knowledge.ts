// Employment vertical knowledge hooks (Phase 14).
//
// No separate store, no second resolver. Curated knowledge keys relevant to
// employment deals (currently none: the production corpus holds no
// employment-specific sources, and that absence is represented as absence),
// plus a filter over shared resolver output. When employment-applicable
// items are curated, their keys get added here; resolution still flows through
// Context to Knowledge Resolver to Candidates.

import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"

// Curated knowledge keys relevant to employment deals. Empty until real
// employment sources are ingested. Never synthetic lookalikes.
export const EMPLOYMENT_KNOWLEDGE_KEYS: readonly string[] = []

// Narrows resolved candidates to employment-relevant ones: items that are
// unconstrained by deal type, items scoped to employment, and explicitly
// curated keys. Pure filter over resolver output; it never re-resolves.
export function selectEmploymentCandidates(candidates: KnowledgeCandidate[]): KnowledgeCandidate[] {
  return candidates.filter(
    (c) =>
      EMPLOYMENT_KNOWLEDGE_KEYS.includes(c.itemKey) ||
      c.applicabilityDealTypes === undefined ||
      c.applicabilityDealTypes.includes("employment")
  )
}
