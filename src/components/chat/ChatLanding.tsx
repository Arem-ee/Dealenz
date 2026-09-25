"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Plus, Trash2 } from "lucide-react"
import { getPendingDeal } from "@/lib/pending-deal"
import { dealMomentState, DEAL_MOMENT_LABEL } from "@/lib/deals/moment"
import type { DayBucket } from "@/lib/activity/week"
import { cn } from "@/lib/utils"
import { deleteDeal } from "@/app/audit/[id]/actions"
import { useToast } from "@/components/ui/toast"
import { CapabilityStrip } from "@/components/home/CapabilityStrip"

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

// Per-deal erasure, two taps: arm, then confirm. Sits above the row's
// stretched link (relative + z-10) with propagation stopped so deleting
// never navigates. Refreshes server state on success; surfaces the real
// failure message otherwise.
function DeleteDealCell({ auditId, title }: { auditId: string; title: string }) {
  const router = useRouter()
  const { showError } = useToast()
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function confirm() {
    setBusy(true)
    setFailed(false)
    try {
      const res = await deleteDeal(auditId)
      if (!res.ok) {
        // Stay armed so the button becomes Retry; the toast carries why.
        setFailed(true)
        showError(res.error)
        return
      }
      router.refresh()
    } catch {
      setFailed(true)
      showError("We couldn't delete this deal. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <td className="relative z-10 whitespace-nowrap px-2 py-3 text-right">
      {!armed ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setFailed(false)
            setArmed(true)
          }}
          aria-label={`Delete ${title || "untitled deal"}`}
          title="Delete this deal"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              void confirm()
            }}
            aria-label={`Confirm deletion of ${title || "untitled deal"}`}
            className="rounded-lg bg-destructive px-2 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "…" : failed ? "Retry" : "Delete?"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              setArmed(false)
            }}
            aria-label="Cancel deletion"
            className="rounded-lg px-1.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Keep
          </button>
        </span>
      )}
    </td>
  )
}

const LOOP_STEPS = [
  { n: "1", title: "Describe", body: "Drop in their contract or explain the situation." },
  { n: "2", title: "Understand", body: "See where the risk sits, with the clause it came from." },
  { n: "3", title: "Push back", body: "Get the exact words to send back." },
  { n: "4", title: "Sign & stay guarded", body: "Both sides sign here; deadlines stay tracked." },
]

const BUBBLE_STYLES = [
  "bg-burgundy text-white",
  "bg-primary text-primary-foreground",
  "bg-foreground/[0.07] text-foreground",
]

const BAR_COLORS = ["bg-burgundy", "bg-primary", "bg-foreground/20"]
const DOT_COLORS = ["bg-burgundy", "bg-primary", "bg-foreground/30"]

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
}

export function ChatLanding({ threads, loadError, deadlines, executedAuditIds, signingAuditIds, monitoredAuditIds, portfolio, week, setupNeeded = false }: {
  threads: ThreadItem[]
  loadError?: string | null
  deadlines?: DeadlineItem[]
  executedAuditIds?: string[]
  signingAuditIds?: string[]
  monitoredAuditIds?: string[]
  portfolio?: PortfolioSummary | null
  week?: DayBucket[]
  setupNeeded?: boolean
}) {
  // Anonymous landing input waits for its composer on /chat: surface a
  // resume banner here instead of a composer — this screen triages.
  const [hasPending] = useState(() => getPendingDeal() !== null)
  // First-run setup nudge: dismissed per browser, and the product never
  // blocks on it — the banner is an invitation, not a gate.
  const [setupDismissed, setSetupDismissed] = useState(() => {
    try {
      return window.localStorage.getItem("dealenz.welcome.dismissed") === "1"
    } catch {
      return false
    }
  })
  const nextDeadline = (deadlines ?? [])[0] ?? null
  const topDeals = [...threads]
    .filter((t) => typeof t.openIssues === "number" && (t.openIssues ?? 0) > 0)
    .sort((a, b) => (b.openIssues ?? 0) - (a.openIssues ?? 0))
    .slice(0, 3)
  const maxCat = Math.max(1, ...(portfolio?.topCategories.map((c) => c.count) ?? [1]))
  const maxWeek = Math.max(1, ...(week ?? []).map((b) => b.count))
  const weekTotal = (week ?? []).reduce((s, b) => s + b.count, 0)
  // Progressive disclosure: zero-signal users get entry points, not empty
  // dashboards. Portfolio tiles render only once analysis has produced
  // something to show (rated deals or open issues) — raw activity like a
  // single deal creation is not signal, and "0 across 0 deals" in display
  // type is cognitive load with zero information.
  const hasPortfolioSignal =
    (portfolio?.ratedCount ?? 0) > 0 || (portfolio?.totalOpen ?? 0) > 0

  // Attention queues (DocuSign quick-views pattern): the same deal moments
  // the table already shows, grouped by who owes what. Unknown moments stay
  // visible under All only — never forced into a queue.
  type QueueFilter = "all" | "needs-you" | "waiting" | "done"
  const NEEDS_YOU = ["needs-action", "needs-attention", "draft"]
  const WAITING = ["negotiating", "ready-to-sign"]
  const DONE = ["signed", "guarded"]
  const [queue, setQueue] = useState<QueueFilter>("all")
  const momentRows = threads.map((t) => {
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
    return { t, moment }
  })
  const queueCounts: Record<QueueFilter, number> = {
    all: momentRows.length,
    "needs-you": momentRows.filter((r) => NEEDS_YOU.includes(r.moment)).length,
    waiting: momentRows.filter((r) => WAITING.includes(r.moment)).length,
    done: momentRows.filter((r) => DONE.includes(r.moment)).length,
  }
  const visibleRows = momentRows.filter((r) => {
    if (queue === "needs-you") return NEEDS_YOU.includes(r.moment)
    if (queue === "waiting") return WAITING.includes(r.moment)
    if (queue === "done") return DONE.includes(r.moment)
    return true
  })
  const QUEUE_VIEWS: Array<{ key: QueueFilter; label: string; empty: string }> = [
    { key: "all", label: "All deals", empty: "" },
    { key: "needs-you", label: "Needs you", empty: "Nothing needs you — every deal is either moving or done." },
    { key: "waiting", label: "Waiting on others", empty: "Nothing waiting — no deal is parked with someone else." },
    { key: "done", label: "Signed & guarded", empty: "Nothing signed yet — completed deals land here." },
  ]

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-y-auto px-4 pb-4 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-4 sm:pt-5">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-foreground sm:text-[28px]">Deal Overview</h1>
          <p className="mt-0.5 text-[13px] text-foreground/50">Take control of your deals today.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-foreground/50 sm:inline">{todayLabel()}</span>
          <Link
            href="/audit/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-burgundy px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            New deal
          </Link>
        </div>
      </div>

      <div className="shrink-0 pb-4">
        <CapabilityStrip />
      </div>

      {loadError && (
        <div role="alert" className="mb-3 flex shrink-0 items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>We couldn&apos;t load your deals. {loadError}</span>
        </div>
      )}

      {hasPending && (
        <Link
          href="/chat"
          className="mb-3 block shrink-0 rounded-2xl border border-border bg-card px-4 py-3 text-xs transition-colors hover:bg-muted/40"
        >
          <span className="font-semibold">Your deal text is waiting.</span>{" "}
          <span className="text-muted-foreground">Continue where you left off →</span>
        </Link>
      )}

      {setupNeeded && !setupDismissed && (
        <div className="mb-3 flex shrink-0 items-center gap-3 rounded-2xl border border-burgundy/20 bg-burgundy/[0.04] px-4 py-3">
          <p className="min-w-0 flex-1 text-xs leading-relaxed">
            <span className="font-semibold">2 minutes, pays off in every deal.</span>{" "}
            <span className="text-muted-foreground">Add your name and country once — documents carry them, questions drop.</span>
          </p>
          <Link
            href="/welcome"
            className="shrink-0 rounded-full bg-burgundy px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            Set up
          </Link>
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.setItem("dealenz.welcome.dismissed", "1")
              } catch {
                // Preference simply does not persist.
              }
              setSetupDismissed(true)
            }}
            aria-label="Dismiss setup suggestion"
            className="shrink-0 rounded-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Later
          </button>
        </div>
      )}

      {threads.length > 0 && portfolio && hasPortfolioSignal && (
        <>
          <section aria-label="Portfolio health" className="grid shrink-0 gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5 lg:row-span-2">
              <div className="flex items-start justify-between">
                <p className="text-[13px] font-semibold">Open Issues</p>
              </div>
              <p className="mt-2 text-[30px] font-semibold leading-none tracking-tight" data-numeric>
                {portfolio.totalOpen}
                <span className="ml-1 align-middle text-[13px] font-normal text-foreground/45">across {portfolio.openDeals} deal{portfolio.openDeals === 1 ? "" : "s"}</span>
              </p>
              {topDeals.length > 0 && (
                <div className="mt-4 flex items-center">
                  {topDeals.map((t, i) => (
                    <div
                      key={t.id}
                      title={`${t.title || "Untitled"} — ${t.openIssues} open`}
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ring-4 ring-white",
                        BUBBLE_STYLES[i % BUBBLE_STYLES.length],
                        i > 0 && "-ml-4"
                      )}
                    >
                      {t.openIssues}
                    </div>
                  ))}
                  <div className="ml-3 min-w-0 space-y-0.5">
                    {topDeals.map((t) => (
                      <p key={t.id} className="truncate text-[11px] text-foreground/50">
                        <span className="font-semibold text-foreground">{t.openIssues}</span> · {t.title || "Untitled"}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {portfolio.topCategories.length > 0 && (
                <div className="mt-4 space-y-2.5">
                  {portfolio.topCategories.map((c, i) => {
                    const pct = Math.round((c.count / Math.max(1, portfolio.totalOpen)) * 100)
                    return (
                      <div key={c.label}>
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-[18px] font-semibold tracking-tight" data-numeric>
                            {pct}<span className="text-[13px] font-normal text-foreground/45"> %</span>
                          </p>
                          <p className="truncate text-[11px] text-foreground/50">{c.label} <span aria-hidden className={cn("ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle", DOT_COLORS[i % DOT_COLORS.length])} /></p>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                          <div className={cn("h-full rounded-full", BAR_COLORS[i % BAR_COLORS.length])} style={{ width: `${Math.max(6, Math.round((c.count / maxCat) * 100))}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-[13px] font-semibold">Avg Risk</p>
              {portfolio.avgScore !== null ? (
                <>
                  <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight" data-numeric>
                    {portfolio.avgScore}<span className="text-[13px] font-normal text-foreground/45"> /100</span>
                  </p>
                  <p className="mt-1 text-[11px] text-foreground/50">Avg across {portfolio.ratedCount} rated deal{portfolio.ratedCount === 1 ? "" : "s"}</p>
                </>
              ) : (
                <p className="mt-2 text-xs text-foreground/50">No rated deals yet — ratings appear after analysis.</p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-[13px] font-semibold">Next Deadline</p>
              {nextDeadline ? (
                <Link href={nextDeadline.href} className="group mt-2 block">
                  <p className="truncate text-[15px] font-semibold leading-snug group-hover:underline">{nextDeadline.title}</p>
                  <p className="mt-1 text-[11px] text-foreground/50">
                    {new Date(nextDeadline.dueDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </Link>
              ) : (
                <p className="mt-2 text-xs text-foreground/50">Nothing dated tracked. Deadlines appear after signing.</p>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-[13px] font-semibold">Resolved</p>
              <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight" data-numeric>
                {threads.reduce((s, t) => s + (typeof t.resolvedCount === "number" ? t.resolvedCount : 0), 0)}
              </p>
              <p className="mt-1 text-[11px] text-foreground/50">pushbacks landed via re-check</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold">This Week</p>
                <p className="text-[11px] text-foreground/50">Last 7 days</p>
              </div>
              <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight" data-numeric>
                {weekTotal}
                <span className="ml-1 align-middle text-[11px] font-normal text-foreground/50">deal events</span>
              </p>
              <div className="mt-3 flex h-20 items-end gap-1.5">
                {(week ?? []).map((b) => (
                  <div key={b.key} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${b.label}: ${b.count}`}>
                    <span
                      className={cn("w-full rounded-sm", b.isToday ? "bg-burgundy" : "bg-foreground/[0.08]")}
                      style={{ height: `${Math.max(5, Math.round((b.count / maxWeek) * 100))}%` }}
                    />
                    <span className={cn("truncate text-[11px]", b.isToday ? "font-semibold text-foreground" : "text-foreground/50")}>
                      {b.isToday ? "Now" : b.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section aria-label="All deals" className="mt-3 shrink-0 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex gap-1 overflow-x-auto border-b border-border/60 px-3 py-2" role="tablist" aria-label="Deal queues">
              {QUEUE_VIEWS.map((v) => (
                <button
                  key={v.key}
                  role="tab"
                  aria-selected={queue === v.key}
                  onClick={() => setQueue(v.key)}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    queue === v.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v.label} · <span data-numeric>{queueCounts[v.key]}</span>
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-[0.08em] text-foreground/45">
                  <th scope="col" className="px-5 py-3 font-semibold">Deal</th>
                  <th scope="col" className="px-2 py-3 font-semibold">State</th>
                  <th scope="col" className="px-2 py-3 text-right font-semibold">Open</th>
                  <th scope="col" className="hidden px-2 py-3 font-semibold sm:table-cell">Risk</th>
                  <th scope="col" className="hidden px-5 py-3 text-right font-semibold md:table-cell">Updated</th>
                  <th scope="col" className="w-10 px-2 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRows.map(({ t, moment }) => {
                  const pill = riskPill(t.riskLevel)
                  return (
                    <tr key={t.id} className="relative cursor-pointer transition-colors hover:bg-foreground/[0.02]">
                      <td className="max-w-0 px-5 py-3">
                        <Link href={`/chat/${t.id}`} className="block truncate font-medium hover:underline after:absolute after:inset-0" aria-label={`Open ${t.title || "Untitled deal"}`}>
                          {t.title || "Untitled"}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-xs font-semibold">{DEAL_MOMENT_LABEL[moment]}</td>
                      <td className="px-2 py-3 text-right text-xs tabular-nums">
                        {typeof t.openIssues === "number" ? t.openIssues : "—"}
                      </td>
                      <td className="hidden px-2 py-3 sm:table-cell">
                        {pill && t.riskLevel ? (
                          <span className={`inline-block rounded-full border px-1.5 py-px text-[10px] font-medium ${pill}`}>
                            {t.riskLevel}
                          </span>
                        ) : (
                          <span className="text-xs text-foreground/40">—</span>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-5 py-3 text-right text-xs text-foreground/45 md:table-cell">
                        {formatDate(t.updatedAt)}
                      </td>
                      {t.auditId ? (
                        <DeleteDealCell auditId={t.auditId} title={t.title} />
                      ) : (
                        <td className="px-2 py-3" />
                      )}
                    </tr>
                  )
                })}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-xs text-muted-foreground">
                      {QUEUE_VIEWS.find((v) => v.key === queue)?.empty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </section>
        </>
      )}

      {threads.length === 0 && !loadError && (
        <div className="pb-4">
          <div className="grid gap-2 px-2 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP_STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <p className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {s.n}
                </p>
                <p className="mt-2 text-[13px] font-semibold">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground/50">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 px-2">
            <Link
              href="/audit/new"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-burgundy px-5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              New deal
            </Link>
            <Link
              href="/library?mode=inbox"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/60"
            >
              Import from Gmail
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
