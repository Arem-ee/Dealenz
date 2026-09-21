"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, Plus } from "lucide-react"
import { getPendingDeal } from "@/lib/pending-deal"
import { dealMomentState, DEAL_MOMENT_LABEL } from "@/lib/deals/moment"
import type { DayBucket } from "@/lib/activity/week"
import { cn } from "@/lib/utils"

interface ThreadItem {
  id: string
  title: string
  auditId: string | null
  updatedAt: string
  status?: string | null
  riskLevel?: string | null
  overallScore?: number | null
  openIssues?: number | null
  resolvedCount?: number | null
  topCategories?: Array<{ label: string; count: number }>
}

export interface DeadlineItem {
  id: string
  auditId: string
  title: string
  dueDate: string
  href: string
}

export interface PortfolioSummary {
  totalOpen: number
  openDeals: number
  avgScore: number | null
  ratedCount: number
  topCategories: Array<{ label: string; count: number }>
  weekTotal: number
}

function formatDate(date: string): string {
  const d = new Date(date)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function riskPill(level: string | null | undefined): string | null {
  if (!level) return null
  const l = level.toLowerCase()
  if (l === "high" || l === "critical") return "border-red-500/30 bg-red-500/5 text-red-700"
  if (l === "medium" || l === "material") return "border-amber-500/30 bg-amber-500/5 text-amber-700"
  if (l === "low") return "border-border bg-muted/50 text-muted-foreground"
  return null
}

const LOOP_STEPS = [
  { n: "1", title: "Describe", body: "Drop in their contract or explain the situation." },
  { n: "2", title: "Understand", body: "See where the risk sits, with the clause it came from." },
  { n: "3", title: "Push back", body: "Get the exact words to send back." },
  { n: "4", title: "Sign & stay guarded", body: "Both sides sign here; deadlines stay tracked." },
]

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ChatLanding({ threads, loadError, deadlines, executedAuditIds, signingAuditIds, monitoredAuditIds, portfolio, week }: {
  threads: ThreadItem[]
  loadError?: string | null
  deadlines?: DeadlineItem[]
  executedAuditIds?: string[]
  signingAuditIds?: string[]
  monitoredAuditIds?: string[]
  portfolio?: PortfolioSummary | null
  week?: DayBucket[]
}) {
  // Anonymous landing input waits for its composer on /chat: surface a
  // resume banner here instead of a composer — this screen triages.
  const [hasPending] = useState(() => getPendingDeal() !== null)
  const today = todayKey()
  const nextDeadline = (deadlines ?? [])[0] ?? null
  const topDeals = [...threads]
    .filter((t) => typeof t.openIssues === "number" && (t.openIssues ?? 0) > 0)
    .sort((a, b) => (b.openIssues ?? 0) - (a.openIssues ?? 0))
    .slice(0, 3)
  const maxCat = Math.max(1, ...(portfolio?.topCategories.map((c) => c.count) ?? [1]))
  const maxWeek = Math.max(1, ...(week ?? []).map((b) => b.count))

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-y-auto px-4 pb-4">
      <div className="flex shrink-0 items-center justify-between gap-3 pb-3 pt-4 sm:pt-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--burgundy)]">Counterparty-side review</p>
          <h1 className="mt-1 font-serif text-[26px] font-semibold leading-tight tracking-[-0.01em] sm:text-[30px]">Your deals</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {new Date(`${today}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <Link
            href="/audit/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            New deal
          </Link>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mb-3 flex shrink-0 items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>We couldn&apos;t load your deals. {loadError}</span>
        </div>
      )}

      {hasPending && (
        <Link
          href="/chat"
          onClick={() => {
            // Kept staged until the /chat composer consumes it on send.
          }}
          className="mb-3 block shrink-0 rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-3 text-xs transition-colors hover:bg-primary/[0.07]"
        >
          <span className="font-semibold">Your deal text is waiting.</span>{" "}
          <span className="text-muted-foreground">Continue where you left off →</span>
        </Link>
      )}

      {threads.length > 0 && portfolio && (
        <>
          <section aria-label="Portfolio health" className="grid shrink-0 gap-3 sm:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Open issues</p>
              <p className="mt-1 font-serif text-[44px] font-semibold leading-none tracking-tight" data-numeric>
                {portfolio.totalOpen}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                across {portfolio.openDeals} deal{portfolio.openDeals === 1 ? "" : "s"}
              </p>
              {topDeals.length > 0 && (
                <div className="mt-4 flex items-center">
                  {topDeals.map((t, i) => (
                    <div
                      key={t.id}
                      title={`${t.title || "Untitled"} — ${t.openIssues} open`}
                      className={cn(
                        "flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold ring-4 ring-card",
                        i === 0 && "bg-primary text-primary-foreground",
                        i === 1 && "bg-[var(--burgundy)] text-white",
                        i === 2 && "bg-muted text-foreground",
                        i > 0 && "-ml-3"
                      )}
                    >
                      {t.openIssues}
                    </div>
                  ))}
                  <div className="ml-3 min-w-0 space-y-0.5">
                    {topDeals.map((t) => (
                      <p key={t.id} className="truncate text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{t.openIssues}</span> · {t.title || "Untitled"}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {portfolio.topCategories.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {portfolio.topCategories.map((c) => (
                    <div key={c.label} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate text-[11px] text-muted-foreground">{c.label}</span>
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-[var(--burgundy)]"
                          style={{ width: `${Math.max(6, Math.round((c.count / maxCat) * 100))}%` }}
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right text-[11px] font-medium tabular-nums" data-numeric>{c.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid shrink-0 content-start gap-3">
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Avg risk</p>
                {portfolio.avgScore !== null ? (
                  <>
                    <p className="mt-1 font-serif text-[30px] font-semibold leading-none" data-numeric>{portfolio.avgScore}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">across {portfolio.ratedCount} rated deal{portfolio.ratedCount === 1 ? "" : "s"}</p>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No rated deals yet — ratings appear after analysis.</p>
                )}
              </div>
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Next deadline</p>
                {nextDeadline ? (
                  <Link href={nextDeadline.href} className="group mt-1 block">
                    <p className="truncate text-sm font-semibold group-hover:underline">{nextDeadline.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {new Date(nextDeadline.dueDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </Link>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Nothing dated tracked. Deadlines appear after signing.</p>
                )}
              </div>
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">This week</p>
                <p className="mt-1 font-serif text-[30px] font-semibold leading-none" data-numeric>{portfolio.weekTotal}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">deal events</p>
              </div>
            </div>
          </section>

          {(week ?? []).length > 0 && (
            <section aria-label="Activity this week" className="mt-3 shrink-0 rounded-2xl bg-[#1C1917] p-5 text-white shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Deal activity</p>
                <p className="text-[11px] text-white/50">Last 7 days</p>
              </div>
              <div className="mt-3 flex h-24 items-end gap-2">
                {(week ?? []).map((b) => (
                  <div key={b.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${b.label}: ${b.count}`}>
                    <span
                      className={cn("w-full max-w-8 rounded-sm", b.isToday ? "bg-[var(--burgundy)]" : "bg-white/15")}
                      style={{ height: `${Math.max(6, Math.round((b.count / maxWeek) * 100))}%` }}
                    />
                    <span className={cn("text-[10px]", b.isToday ? "font-semibold text-white" : "text-white/45")}>
                      {b.isToday ? "Today" : b.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-label="All deals" className="mt-3 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Deal</th>
                  <th scope="col" className="px-2 py-2.5 font-semibold">State</th>
                  <th scope="col" className="px-2 py-2.5 text-right font-semibold">Open</th>
                  <th scope="col" className="hidden px-2 py-2.5 font-semibold sm:table-cell">Risk</th>
                  <th scope="col" className="hidden px-4 py-2.5 text-right font-semibold md:table-cell">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
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
                  const pill = riskPill(t.riskLevel)
                  return (
                    <tr key={t.id} className="transition-colors hover:bg-muted/40">
                      <td className="max-w-0 px-4 py-2.5">
                        <Link href={`/chat/${t.id}`} className="block truncate font-medium hover:underline">
                          {t.title || "Untitled"}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-xs font-medium">{DEAL_MOMENT_LABEL[moment]}</td>
                      <td className="px-2 py-2.5 text-right text-xs tabular-nums">
                        {typeof t.openIssues === "number" ? t.openIssues : "—"}
                      </td>
                      <td className="hidden px-2 py-2.5 sm:table-cell">
                        {pill && t.riskLevel ? (
                          <span className={`inline-block rounded-full border px-1.5 py-px text-[10px] font-medium ${pill}`}>
                            {t.riskLevel}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-right text-xs text-muted-foreground md:table-cell">
                        {formatDate(t.updatedAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      {threads.length === 0 && !loadError && (
        <div className="pb-4">
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
          <div className="mt-3 px-2">
            <Link
              href="/audit/new"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              New deal
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
