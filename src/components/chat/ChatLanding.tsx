"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Composer } from "./Composer"
import { clearPendingDeal, getPendingDeal } from "@/lib/pending-deal"
import { dealMomentState, DEAL_MOMENT_LABEL } from "@/lib/deals/moment"

interface ThreadItem {
  id: string
  title: string
  auditId: string | null
  updatedAt: string
  status?: string | null
  riskLevel?: string | null
  openIssues?: number | null
  budget?: string | null
  dealType?: string | null
  jurisdiction?: string | null
  counterpartyRole?: string | null
  resolvedCount?: number | null
  topFindings?: string[]
}

export interface DeadlineItem {
  id: string
  auditId: string
  title: string
  dueDate: string
  href: string
}

function formatDate(date: string): string {
  const d = new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const LOOP_STEPS = [
  { n: "1", title: "Describe", body: "Drop in their contract or explain the situation." },
  { n: "2", title: "Understand", body: "See where the risk sits, with the clause it came from." },
  { n: "3", title: "Push back", body: "Get the exact words to send back." },
  { n: "4", title: "Sign & stay guarded", body: "Both sides sign here; deadlines stay tracked." },
]

/**
 * Deal-first Home: the loop promise up top, the composer, one understated
 * Library link, then recent deals with their state. No action cards, no
 * tours, no tooltips — the classifier routes whatever is typed, and the UI
 * stays out of its way.
 */
export function ChatLanding({ threads, loadError, stats, deadlines, executedAuditIds, signingAuditIds, monitoredAuditIds }: {
  threads: ThreadItem[]
  loadError?: string | null
  stats?: { deals: number | null; analyzed: number | null } | null
  deadlines?: DeadlineItem[]
  executedAuditIds?: string[]
  signingAuditIds?: string[]
  monitoredAuditIds?: string[]
}) {
  // Anonymous landing input waits here after signup/signin: prefill on every
  // fresh mount (the composer applies it once per key) and clear on the
  // first successful send, so intent survives navigation but never
  // resurrects after it is used.
  const [pendingPrefill] = useState<{ text: string; key: number } | null>(() => {
    const pending = getPendingDeal()
    if (!pending) return null
    return { text: pending, key: Date.now() }
  })
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col px-4">
      <div className="shrink-0 pb-3 pt-4 sm:pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--burgundy)]">Counterparty-side review</p>
        <h1 className="mt-1.5 font-serif text-[28px] font-semibold leading-tight tracking-[-0.01em] sm:text-[32px]">Send us their contract.</h1>
        <p className="mt-1 text-sm text-muted-foreground">Get back what to push back on — in your words. Sign here. Stay guarded.</p>
        {loadError && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>We couldn&apos;t load your recent threads. {loadError}</span>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {(stats || (deadlines && deadlines.length > 0)) && (
            <div className="mb-3 space-y-2 px-2">
              {stats && (stats.deals !== null || stats.analyzed !== null) && (
                <p className="text-xs text-muted-foreground">
                  {stats.deals !== null && <span className="font-medium text-foreground">{stats.deals} deal{stats.deals === 1 ? "" : "s"}</span>}
                  {stats.deals !== null && stats.analyzed !== null && " · "}
                  {stats.analyzed !== null && <span><span className="font-medium text-foreground">{stats.analyzed}</span> analyzed</span>}
                </p>
              )}
              {deadlines && deadlines.length > 0 && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">Upcoming deadlines</p>
                  <ul className="mt-1.5 space-y-1">
                    {deadlines.map((d) => {
                      const overdue = new Date(d.dueDate + "T00:00:00Z").getTime() < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()
                      return (
                        <li key={d.id}>
                          <Link href={d.href} className="flex items-baseline justify-between gap-3 text-xs hover:underline">
                            <span className="min-w-0 truncate font-medium">{d.title}</span>
                            <span className={`shrink-0 font-medium tabular-nums ${overdue ? "text-red-700" : "text-amber-700"}`}>
                              {overdue ? "Overdue · " : ""}{new Date(d.dueDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
          {/* Deal inbox stream: deals live in the sidebar as a compact
              switcher on desktop; here every deal reads as a triage row —
              state, attention, next notice, one action. */}
          <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Your deals</h2>
          <ul aria-label="Your deals" className="space-y-2.5">
            {threads.map((t) => {
              const executed = !!t.auditId && (executedAuditIds ?? []).includes(t.auditId)
              const signingActive = !!t.auditId && (signingAuditIds ?? []).includes(t.auditId) && !executed
              const hasMonitoring = !!t.auditId && (monitoredAuditIds ?? []).includes(t.auditId)
              const moment = dealMomentState({
                status: t.status,
                openIssues: t.openIssues ?? null,
                resolvedCount: t.resolvedCount ?? null,
                executed,
                signingActive,
                hasMonitoring,
              })
              const notice = t.auditId ? (deadlines ?? []).find((d) => d.auditId === t.auditId) : undefined
              const metaParts: string[] = []
              if (t.budget) metaParts.push(t.budget)
              if (t.dealType) metaParts.push(t.dealType.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()))
              if (t.counterpartyRole) metaParts.push(`${t.counterpartyRole.replace(/^\w/, (c) => c.toUpperCase())} paper`)
              else if (t.jurisdiction) metaParts.push(t.jurisdiction)
              metaParts.push(formatDate(t.updatedAt))
              const stateTone =
                moment === "needs-action" || moment === "needs-attention"
                  ? "text-red-700"
                  : moment === "negotiating"
                    ? "text-amber-700"
                    : moment === "ready-to-sign" || moment === "signed" || moment === "guarded"
                      ? "text-emerald-700"
                      : "text-muted-foreground"
              const cta = moment === "needs-action" || moment === "negotiating" ? "Review deal →" : "Open →"
              return (
                <li key={t.id} className="rounded-xl border border-border/60 bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate font-serif text-[15px] font-semibold leading-snug">{t.title || "Untitled"}</p>
                    <p className={`shrink-0 text-[12px] font-semibold uppercase tracking-[0.08em] ${stateTone}`}>
                      {DEAL_MOMENT_LABEL[moment]}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{metaParts.join(" · ")}</p>
                  {moment === "guarded" && notice && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Next notice: <span className="font-medium text-foreground">{notice.title}</span> ·{" "}
                      {new Date(notice.dueDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  )}
                  {moment === "guarded" && !notice && hasMonitoring && (
                    <p className="mt-1.5 text-xs text-muted-foreground">Obligations being watched.</p>
                  )}
                  {typeof t.openIssues === "number" && t.openIssues > 0 && (
                    <div className="mt-1.5">
                      <p className="text-xs font-medium">
                        {t.openIssues} thing{t.openIssues === 1 ? "" : "s"} need{t.openIssues === 1 ? "s" : ""} your attention
                      </p>
                      {t.topFindings && t.topFindings.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {t.topFindings.map((s, i) => (
                            <li key={i} className="truncate text-xs text-muted-foreground">{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {typeof t.openIssues === "number" && t.openIssues === 0 && (t.resolvedCount ?? 0) > 0 && (
                    <p className="mt-1.5 text-xs text-muted-foreground">All previous issues resolved. No new findings.</p>
                  )}
                  {moment === "draft" && (
                    <p className="mt-1.5 text-xs text-muted-foreground">Not analyzed yet.</p>
                  )}
                  <div className="mt-2">
                    <Link href={`/chat/${t.id}`} className="text-xs font-semibold text-primary hover:underline">
                      {cta}
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      {threads.length === 0 && !loadError && (
        <div className="min-h-0 flex-1 overflow-y-auto pb-3">
          <div className="grid gap-2 px-2 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP_STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border border-border/60 bg-card p-3.5">
                <p className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {s.n}
                </p>
                <p className="mt-2 text-[13px] font-semibold">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 px-2 text-xs text-muted-foreground">Start below — paste their contract, drop the file, or describe the deal.</p>
          <div className="mt-2 px-2">
            <Link
              href="/library"
              className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Browse the Library
            </Link>
          </div>
        </div>
      )}
      <div className="shrink-0 py-2">
        <Link
          href="/library"
          className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Browse the Library
        </Link>
      </div>
      <div className="shrink-0 pb-4">
        <Composer
          prefill={pendingPrefill}
          onMessageSent={() => {
            if (pendingPrefill) clearPendingDeal()
          }}
        />
      </div>
    </div>
  )
}
