"use client"

import { dealMomentState, DEAL_MOMENT_LABEL, type DealMoment } from "@/lib/deals/moment"

// Deal overview: the deal, not the document, is the centerpiece. One
// header answers the four standing questions — what am I dealing with,
// what can hurt me, what should I do, what happens next — and the block
// reshapes as the moment changes. All fields come from persisted reads;
// absent stays absent.
export interface DealOverviewItem {
  title: string
  summary: string
  severity: string
}

const MOMENT_TONE: Record<DealMoment, string> = {
  "needs-action": "text-red-700",
  negotiating: "text-amber-700",
  "ready-to-sign": "text-emerald-700",
  signed: "text-emerald-700",
  guarded: "text-emerald-700",
  "needs-attention": "text-red-700",
  draft: "text-muted-foreground",
  unknown: "text-muted-foreground",
}

export function DealOverview({ input }: {
  input: {
    title: string | null
    budget: string | null
    dealType: string | null
    userRole: string | null
    counterpartyRole: string | null
    jurisdiction: string | null
    status?: string | null
    openIssues: number | null
    resolvedCount: number
    executed: boolean
    signingActive: boolean
    hasMonitoring: boolean
    topIssues: DealOverviewItem[]
    signedLabel: string | null
    onAskPushback: () => void
    onAskRecheck: () => void
  }
}) {
  const d = input
  const moment = dealMomentState({
    status: d.status,
    openIssues: d.openIssues,
    resolvedCount: d.resolvedCount,
    executed: d.executed,
    signingActive: d.signingActive,
    hasMonitoring: d.hasMonitoring,
  })
  const metaParts: string[] = []
  if (d.budget) metaParts.push(d.budget)
  if (d.dealType) metaParts.push(d.dealType.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()))
  if (d.counterpartyRole) metaParts.push(`${d.counterpartyRole.replace(/^\w/, (c) => c.toUpperCase())} paper`)
  else if (d.userRole) metaParts.push(`You: ${d.userRole}`)
  if (d.jurisdiction) metaParts.push(d.jurisdiction)

  return (
    <section aria-label="Deal overview" className="mx-auto w-full max-w-3xl px-4 pt-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {d.counterpartyRole ? `${d.counterpartyRole.replace(/^\w/, (c) => c.toUpperCase())} paper` : "Deal"}
        </p>
        <h2 className="mt-1  text-[22px] font-semibold leading-tight tracking-[-0.01em]">
          {d.title || "Untitled deal"}
        </h2>
        {metaParts.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{metaParts.join(" · ")}</p>
        )}

        <div className="mt-4 border-t border-border/60 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Deal status</p>
          <p className={`mt-1 text-[17px] font-semibold uppercase tracking-[0.04em] ${MOMENT_TONE[moment]}`}>
            {moment === "needs-action" && d.openIssues !== null
              ? `${DEAL_MOMENT_LABEL[moment]} — ${d.openIssues} issue${d.openIssues === 1 ? "" : "s"} worth pushing back on`
              : DEAL_MOMENT_LABEL[moment]}
          </p>
          {d.signedLabel && (
            <p className="mt-1 text-xs text-muted-foreground">{d.signedLabel}</p>
          )}
        </div>

        {d.topIssues.length > 0 && !d.executed && (
          <div className="mt-4 border-t border-border/60 pt-4">
            <ul className="space-y-2.5">
              {d.topIssues.slice(0, 3).map((issue, i) => (
                <li key={i}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {issue.title || `Issue ${i + 1}`}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-relaxed">{issue.summary}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={d.onAskPushback}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                See what to say
              </button>
              <button
                type="button"
                onClick={d.onAskRecheck}
                className="rounded-full border border-input bg-background px-4 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Re-check latest version
              </button>
            </div>
          </div>
        )}

        {d.executed && (
          <div className="mt-4 border-t border-border/60 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Signed version</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fully executed and immutable. Further changes need a new draft.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
