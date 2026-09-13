import type { LegalCitationView } from "@/lib/legal-research/format"

export function LegalCitationLine({ citation }: { citation: LegalCitationView }) {
  return (
    <div>
      <p className="font-medium text-foreground">
        {citation.title} — {citation.section}
      </p>
      {citation.passage ? <p className="text-muted-foreground">“{citation.passage}”</p> : null}
      {citation.url ? (
        <a href={citation.url} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
          {citation.url}
        </a>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        {citation.jurisdiction} · Tier {citation.authorityTier} · {citation.effectiveStatus} · retrieved {citation.retrievedAt.slice(0, 10)}
      </p>
    </div>
  )
}
