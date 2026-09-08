// Compact evidence presentation (Phase 7).
//
// One reusable line answering Finding → Why → Source. Shows the quoted
// observation and where it came from, or nothing at all when a finding
// carries no evidence. Never fabricates locations: approximate locations name
// their section, unavailable locations say the source cannot be opened.

import type { Evidence } from "@/lib/evidence/schema"

function sourceLabel(evidence: Evidence): string {
  switch (evidence.sourceType) {
    case "audit_input":
      return "Deal input"
    case "conversation_input":
      return "Your message"
    case "extraction":
      return "Extracted details"
    case "knowledge":
      return evidence.sourceId ?? "Knowledge source"
  }
}

function locationLabel(evidence: Evidence): string | null {
  if (evidence.location.kind === "exact") return "exact location"
  if (evidence.location.kind === "approximate") {
    return evidence.location.section ? `near “${evidence.location.section.replaceAll("_", " ")}”` : "approximate location"
  }
  return evidence.inspectable ? null : "source cannot be opened"
}

export function EvidenceLine({ evidence }: { evidence: Evidence }) {
  const location = locationLabel(evidence)
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium">Source: </span>
      {evidence.quote ? <span>“{evidence.quote}” — </span> : null}
      <span>
        {sourceLabel(evidence)}
        {location ? ` (${location})` : ""}
      </span>
    </p>
  )
}
