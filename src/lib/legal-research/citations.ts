// Citation helpers (Phase 27).
//
// Every legal answer must expose supporting authority. Citations map to
// retrieved source material — never fabricated from model memory.

import type { LegalCitation, LegalSource } from "./types"
import { MAX_CITATION_PASSAGE_CHARS, isAllowedUrl } from "./allowlist"

export function citationFromSource(source: LegalSource): LegalCitation {
  return {
    sourceId: source.id,
    title: source.title,
    section: source.sourceReference,
    url: source.originalUri,
    passage: source.excerpt.slice(0, MAX_CITATION_PASSAGE_CHARS),
    retrievedAt: source.retrievedAt,
    effectiveStatus: source.temporalStatus,
    jurisdiction: source.jurisdiction.country,
    authorityTier: source.authorityTier,
  }
}

export function validateCitations(citations: LegalCitation[], sources: LegalSource[]): { valid: boolean; reason: string | null } {
  for (const c of citations) {
    if (!c.url || !isAllowedUrl(c.url)) return { valid: false, reason: `Citation URL not allowlisted: ${c.url}` }
    const source = sources.find((s) => s.id === c.sourceId)
    if (!source) return { valid: false, reason: `Citation sourceId not found: ${c.sourceId}` }
    if (!source.content.includes(c.passage.slice(0, Math.min(30, c.passage.length)))) {
      return { valid: false, reason: `Citation passage does not match source content for ${c.sourceId}` }
    }
  }
  return { valid: true, reason: null }
}
