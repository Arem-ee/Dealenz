// Lease vertical knowledge hooks (Phase 6).
//
// No separate store, no second resolver. Curated knowledge keys relevant to
// lease deals (currently none: the production corpus holds no lease-specific
// sources, and that absence is represented as absence), plus a filter over
// shared resolver output. When lease-applicable items are curated, their keys
// get added here; resolution still flows through Context to Knowledge
// Resolver to Candidates.

import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"

// Curated knowledge keys relevant to lease deals. Seeded by migration
// 00038 (US/UK/DE/FR/NL lease sources). Never synthetic lookalikes.
export const LEASE_KNOWLEDGE_KEYS: readonly string[] = [
  "us-ca-civil-tenancy",
  "uk-landlord-tenant-1954",
  "de-bgb-contracts",
  "fr-code-civil-contracts",
  "nl-bw-contracts",
]

// Narrows resolved candidates to lease-relevant ones: items that are
// unconstrained by deal type, items scoped to lease, and explicitly curated
// keys. Pure filter over resolver output; it never re-resolves or invents.
export function selectLeaseCandidates(candidates: KnowledgeCandidate[]): KnowledgeCandidate[] {
  return candidates.filter(
    (c) =>
      LEASE_KNOWLEDGE_KEYS.includes(c.itemKey) ||
      c.applicabilityDealTypes === undefined ||
      c.applicabilityDealTypes.includes("lease")
  )
}
