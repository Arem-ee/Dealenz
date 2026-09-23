"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react"
import { EvidenceLine } from "@/components/evidence/evidence-line"
import { PushbackWords } from "@/components/findings/pushback-words"
import { ShareReportButton } from "@/components/findings/share-report-button"
import type { Evidence } from "@/lib/evidence/schema"

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Fix before signing",
  material: "Should fix",
  attention: "Worth checking",
  informational: "For context",
}

export function RiskReportCard({ payload, onAskFinding, auditId }: { payload: Record<string, unknown>; onAskFinding?: (question: string) => void; auditId?: string | null }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const findings = (payload.findings as Array<{ ruleKey?: string | null; severity: string; summary: string; whyItMatters?: string; guidance?: string; pushback?: string; evidence?: Evidence[] }> ) ?? []
  const riskLevel = (payload.riskLevel as string) ?? "Unknown"
  const overallScore = payload.overallScore as number | undefined
  const riskDegraded = payload.riskDegraded === true
  const rulesDegraded = payload.rulesDegraded === true

  const grouped = findings.reduce<Record<string, typeof findings>>((acc, f) => {
    const label = SEVERITY_LABEL[f.severity] ?? f.severity
    if (!acc[label]) acc[label] = []
    acc[label].push(f)
    return acc
  }, {})

  if (findings.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-medium">{rulesDegraded ? "Safety checks could not complete" : "No major risks found"}</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {rulesDegraded
            ? "The deterministic checks failed to run, so an empty report means unknown, not safe. Please try the analysis again."
            : "We checked what you shared and nothing stands out as needing a fix before signing."}
        </p>
        {riskDegraded && (
          <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-700">
            Heuristic assessment only: AI analysis was unavailable, so even this clean result comes from deterministic checks. Re-run when service recovers for a full review.
          </p>
        )}
      </div>
    )
  }

  // Numbered across severity groups in display order: "01 PAYMENT TERMS".
  // Offsets precomputed (no render-time mutation): StrictMode-safe.
  let runningTotal = 0
  const groupEntries = Object.entries(grouped).map(([label, items]) => {
    const start = runningTotal
    runningTotal += items.length
    return {
      label,
      items: items.map((f, i) => ({ finding: f, num: String(start + i + 1).padStart(2, "0") })),
    }
  })

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">How this deal looks</p>
        <p className="shrink-0 text-xs text-muted-foreground">{typeof overallScore === "number" ? `Overall rating: ${overallScore}/100 · ${riskLevel}` : riskLevel}</p>
      </div>
      {(riskDegraded || rulesDegraded) && (
        <div className="px-4 pt-3 space-y-2">
          {riskDegraded && (
            <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-700">
              Heuristic assessment: AI analysis was unavailable when this ran, so the rating above comes from deterministic checks only. The findings below still stand.
            </p>
          )}
          {rulesDegraded && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive">
              Safety checks could not complete for this analysis. Treat this report as incomplete and re-run before signing.
            </p>
          )}
        </div>
      )}
      <div className="divide-y">
        {groupEntries.map(({ label, items }) => {
          const isOpen = expanded[label] ?? true
          return (
            <div key={label}>
              <button type="button" onClick={() => setExpanded((s) => ({ ...s, [label]: !isOpen }))} className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30">
                <span className="text-sm font-medium">{label} · {items.length}</span>
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 space-y-4">
                  {items.map(({ finding: f, num }, i) => (
                    <div key={i}>
                      <p className="text-sm">
                        <span className="font-semibold tabular-nums text-muted-foreground">{num}</span>{" "}
                        <span className="font-medium">{f.summary}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {f.ruleKey ? f.ruleKey.replace(/-/g, " ") : label} · {f.severity}
                      </p>
                      {Array.isArray(f.evidence) && f.evidence.length > 0 && (
                        <div className="mt-2 space-y-1 border-l-2 border-border pl-2.5">
                          {f.evidence.slice(0, 2).map((ev, j) => (
                            <EvidenceLine key={j} evidence={ev} />
                          ))}
                        </div>
                      )}
                      {f.whyItMatters && (
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.whyItMatters}</p>
                      )}
                      {f.pushback && (
                        <div className="mt-2">
                          <PushbackWords words={f.pushback} auditId={auditId} ruleKey={f.ruleKey ?? null} />
                        </div>
                      )}
                      {onAskFinding && (
                        <button
                          type="button"
                          onClick={() => onAskFinding(`Explain this finding: ${f.summary}`)}
                          className="mt-2 text-xs font-medium text-primary hover:underline"
                        >
                          Ask about this finding
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {auditId && findings.length > 0 && (
        <div className="border-t border-border/40 px-4 py-3">
          <ShareReportButton auditId={auditId} />
        </div>
      )}
    </div>
  )
}
