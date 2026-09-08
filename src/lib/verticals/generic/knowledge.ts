// Generic vertical knowledge hooks — intentionally empty.
// No verified generic corpus exists yet; shared resolver still applies
// (global/unconstrained items). No synthetic statutes.

import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"

export const GENERIC_KNOWLEDGE_KEYS: readonly string[] = []

export function selectGenericCandidates(candidates: KnowledgeCandidate[]): KnowledgeCandidate[] {
  return candidates.filter(
    (c) =>
      GENERIC_KNOWLEDGE_KEYS.includes(c.itemKey) ||
      c.applicabilityDealTypes === undefined ||
      c.applicabilityDealTypes.includes("generic")
  )
}
