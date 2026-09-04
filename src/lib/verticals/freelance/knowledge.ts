// Freelance vertical knowledge hooks (Phase 5E).
//
// No separate store, no second resolver. These helpers shape the shared
// Phase 5C pipeline for freelance deals: which knowledge keys the vertical
// cares about (currently none curated — the store is empty by design), and
// how to select freelance-relevant candidates from resolved results. When a
// real corpus exists, keys get added here; resolution still flows through
// Context → Knowledge Resolver → Candidates.

import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"

// Curated knowledge keys relevant to freelance deals. Empty until real
// sources are ingested. Never synthetic lookalikes: absence of sources is
// represented as absence, not fabricated authority.
export const FREELANCE_KNOWLEDGE_KEYS: readonly string[] = []

// Narrows resolved candidates to freelance-relevant ones: items that are
// unconstrained by deal type, items scoped to freelance, and explicitly
// curated keys. Pure filter over resolver output; it never re-resolves or
// invents items.
export function selectFreelanceCandidates(candidates: KnowledgeCandidate[]): KnowledgeCandidate[] {
  return candidates.filter(
    (c) =>
      FREELANCE_KNOWLEDGE_KEYS.includes(c.itemKey) ||
      c.applicabilityDealTypes === undefined ||
      c.applicabilityDealTypes.includes("freelance")
  )
}
