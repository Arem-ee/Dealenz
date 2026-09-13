export interface LegalCitationView {
  title: string
  section: string
  url: string | null
  passage: string
  jurisdiction: string
  authorityTier: number
  effectiveStatus: string
  retrievedAt: string
  sourceId?: string
}

export function formatLegalCitation(citation: LegalCitationView): string {
  const passage = citation.passage ? `: "${citation.passage}"` : ""
  const link = citation.url ?? citation.sourceId ?? citation.title
  const retrieved = citation.retrievedAt ? citation.retrievedAt.slice(0, 10) : "unknown"
  return `${citation.title} — ${citation.section}${passage} [${link}] · ${citation.jurisdiction} · Tier ${citation.authorityTier} · ${citation.effectiveStatus} · retrieved ${retrieved}`
}
