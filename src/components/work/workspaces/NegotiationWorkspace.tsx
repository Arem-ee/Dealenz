"use client"

import { EvidenceLine } from "@/components/evidence/evidence-line"
import { Section } from "./Section"
import { CounterpartyMemorySection } from "./counterparty-memory"
import { OpenItemsList } from "./OpenItemsList"
import type { WorkspaceData } from "./types"

// Negotiation preparation: only what needs pushing back on, the prepared
// points from analysis, and the evidence behind them. No fabricated
// positions; unresolved items are the agenda.
export function NegotiationWorkspace({ data, auditId, onAskFinding }: {
  data: WorkspaceData
  auditId?: string | null
  onAskFinding: (question: string) => void
}) {
  const keyIssues = data.findings.filter((f) => f.severity === "critical" || f.severity === "material")
  return (
    <div>
      <Section
        title={`Key issues${keyIssues.length > 0 ? ` (${keyIssues.length})` : ""}`}
        hint="What to push back on, ordered by attention required."
      >
        {keyIssues.length === 0 ? (
          <p className="text-xs text-muted-foreground">No critical or material issues in the latest analysis. Lower-attention items are in the review workspace.</p>
        ) : (
          <div className="space-y-2">
            {keyIssues.map((f, i) => (
              <div key={f.ruleKey ?? i} className="rounded-xl border bg-card p-3">
                <p className=" text-sm font-medium leading-relaxed">{f.summary}</p>
                {f.whyItMatters && <p className="mt-1  text-xs leading-relaxed text-muted-foreground">{f.whyItMatters}</p>}
                {Array.isArray(f.evidence) && f.evidence.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
                    {f.evidence.slice(0, 2).map((ev, j) => (
                      <EvidenceLine key={j} evidence={ev} />
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onAskFinding(`How should I negotiate this point: ${f.summary}`)}
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                >
                  Prepare a response
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section
        title="Prepared points"
        hint="Points drafted from the analysis of this deal."
      >
        {data.negotiationPoints.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {data.negotiationDegraded
              ? "Preparation points could not be completed for this deal. The key issues above still stand."
              : "No prepared points yet. They are drafted when a non-freelance deal is analyzed."}
          </p>
        ) : (
          <ul className="list-disc space-y-1.5 pl-5  text-sm leading-relaxed">
            {data.negotiationPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Unresolved points" hint="The other side still owes answers on these.">
        <OpenItemsList items={data.openItems} counts={data.openCounts} />
      </Section>
      <CounterpartyMemorySection auditId={auditId} />
    </div>
  )
}
