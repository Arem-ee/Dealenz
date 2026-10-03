"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, Check, Copy, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import {
  listKeeper,
  listWatchedDeals,
  type KeeperConflict,
  type KeeperDeadline,
  type KeeperObligation,
} from "@/app/(app)/tracker/actions"
import {
  createMonitoringEventAction,
  resolveMonitoringEventAction,
} from "@/lib/monitoring/actions"

type Filter = "all" | "obligations" | "renewals" | "deadlines"

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "obligations", label: "Obligations" },
  { key: "renewals", label: "Renewals" },
  { key: "deadlines", label: "Deadlines" },
]

const OBLIGATION_TYPES = new Set(["obligation", "payment_due", "material_event", "custom"])
const RENEWAL_TYPES = new Set(["renewal", "expiration", "notice_period"])

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDue(due: string | null): string {
  if (!due) return "No date"
  const d = new Date(due.length <= 10 ? `${due}T00:00:00` : due)
  if (Number.isNaN(d.getTime())) return due
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function copyLink(path: string, onCopied: () => void) {
  const url = `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`
  if (navigator.clipboard) {
    void navigator.clipboard.writeText(url).then(onCopied).catch(() => window.prompt("Copy this link:", url))
  } else {
    window.prompt("Copy this link:", url)
  }
}

function isOverdueDue(due: string | null): boolean {
  return due !== null && due <= todayISO()
}

function isLapsedExpiry(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now()
}

// Tracker keeper: everything watched in one place — extracted
// obligations, signing deadlines, and cross-contract conflicts.
// Complete/dismiss resolves obligations; signing rows link back to the
// Signing tab where invites are re-sent or revoked.
export function TrackerView() {
  const { showError, showSuccess } = useToast()
  const [filter, setFilter] = useState<Filter>("all")
  const [obligations, setObligations] = useState<KeeperObligation[] | null>(null)
  const [deadlines, setDeadlines] = useState<KeeperDeadline[] | null>(null)
  const [conflicts, setConflicts] = useState<KeeperConflict[] | null>(null)
  const [watchOpen, setWatchOpen] = useState(false)
  const [watchTitle, setWatchTitle] = useState("")
  const [watchDue, setWatchDue] = useState("")
  const [watchType, setWatchType] = useState("obligation")
  const [watchDeals, setWatchDeals] = useState<Array<{ id: string; title: string }>>([])
  const [watchAuditId, setWatchAuditId] = useState("")
  const [busy, setBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const res = await listKeeper()
      if (!res.ok) {
        showError(res.error, "Tracking failed to load")
        setObligations([])
        setDeadlines([])
        setConflicts([])
        return
      }
      setObligations(res.obligations)
      setDeadlines(res.deadlines)
      setConflicts(res.conflicts)
    } catch {
      showError("Tracking failed to load")
      setObligations([])
      setDeadlines([])
      setConflicts([])
    }
  }

  useEffect(() => {
    let live = true
    listKeeper()
      .then((res) => {
        if (!live) return
        if (!res.ok) {
          showError(res.error, "Tracking failed to load")
          setObligations([])
          setDeadlines([])
          setConflicts([])
          return
        }
        setObligations(res.obligations)
        setDeadlines(res.deadlines)
        setConflicts(res.conflicts)
      })
      .catch(() => {
        if (!live) return
        showError("Tracking failed to load")
        setObligations([])
        setDeadlines([])
        setConflicts([])
      })
    return () => {
      live = false
    }
  }, [showError])

  async function resolve(id: string, auditId: string, status: "completed" | "dismissed") {
    if (rowBusy) return
    setRowBusy(id)
    try {
      const res = await resolveMonitoringEventAction(auditId, id, status)
      if (!res.ok) throw new Error(res.error)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't update that item.")
    } finally {
      setRowBusy(null)
    }
  }

  async function watch() {
    if (busy || watchTitle.trim().length < 5 || !watchAuditId) return
    setBusy(true)
    try {
      const res = await createMonitoringEventAction(watchAuditId, {
        eventType: watchType as "obligation" | "deadline" | "renewal" | "custom",
        title: watchTitle.trim().slice(0, 200),
        dueDate: watchDue || null,
        provenance: "user_confirmed",
        source: "user",
      })
      if (!res.ok) throw new Error(res.error)
      showSuccess("Now watching.")
      setWatchOpen(false)
      setWatchTitle("")
      setWatchDue("")
      setWatchType("obligation")
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't watch that.")
    } finally {
      setBusy(false)
    }
  }

  async function toggleWatch() {
    setWatchOpen((v) => !v)
    if (watchDeals.length === 0) {
      try {
        const res = await listWatchedDeals()
        if (res.ok) {
          setWatchDeals(res.deals)
          if (res.deals.length > 0 && !watchAuditId) setWatchAuditId(res.deals[0]!.id)
        }
      } catch {
        // Watch validates the deal server-side; the picker is best-effort.
      }
    }
  }

  const loading = obligations === null || deadlines === null || conflicts === null
  const all = obligations ?? []
  const active = all.filter((o) => o.status === "active")
  const visibleObligations = active.filter((o) => {
    if (filter === "all" || filter === "obligations") return OBLIGATION_TYPES.has(o.eventType) || filter === "all"
    if (filter === "renewals") return RENEWAL_TYPES.has(o.eventType)
    if (filter === "deadlines") return o.eventType === "deadline"
    return true
  })
  const overdueObligations = visibleObligations.filter((o) => isOverdueDue(o.dueDate))
  const upcomingObligations = visibleObligations.filter((o) => !isOverdueDue(o.dueDate))
  const showDeadlines = filter === "all" || filter === "deadlines"
  const showConflicts = filter === "all" || filter === "obligations"
  const lapsedDeadlines = (deadlines ?? []).filter((d) => d.status === "expired" || isLapsedExpiry(d.expiresAt))
  const openDeadlines = (deadlines ?? []).filter((d) => !(d.status === "expired" || isLapsedExpiry(d.expiresAt)))
  const empty =
    !loading &&
    upcomingObligations.length === 0 &&
    overdueObligations.length === 0 &&
    (!showDeadlines || (deadlines ?? []).length === 0) &&
    (!showConflicts || (conflicts ?? []).length === 0)

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-y-auto px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">Tracker</h1>
        <button
          type="button"
          onClick={() => void toggleWatch()}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Watch
        </button>
      </div>

      {watchOpen && (
        <div className="mb-4 border border-border bg-background p-4" aria-label="Watch something">
          <p className="text-sm font-semibold">Watch a date</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Your own reminder on one of your deals — not extracted from any document.</p>
          <label className="mt-2 block text-[11px] font-medium text-muted-foreground" htmlFor="watch-deal">Deal</label>
          <select
            id="watch-deal"
            value={watchAuditId}
            onChange={(e) => setWatchAuditId(e.target.value)}
            disabled={busy}
            className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm disabled:opacity-60"
          >
            <option value="">Pick a deal…</option>
            {watchDeals.map((d) => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
          </select>
          <div className="mt-2 flex flex-col gap-1.5 sm:flex-row">
            <input
              value={watchTitle}
              onChange={(e) => setWatchTitle(e.target.value)}
              disabled={busy}
              placeholder="Renewal lands, notice window opens…"
              aria-label="What to watch"
              autoComplete="off"
              className="h-9 min-w-0 flex-1 border border-input bg-background px-2 text-sm outline-none disabled:opacity-60"
            />
            <input
              value={watchDue}
              onChange={(e) => setWatchDue(e.target.value)}
              disabled={busy}
              type="date"
              aria-label="Due date"
              className="h-9 shrink-0 border border-input bg-background px-2 text-sm outline-none disabled:opacity-60"
            />
            <select
              value={watchType}
              onChange={(e) => setWatchType(e.target.value)}
              disabled={busy}
              aria-label="Watch type"
              className="h-9 shrink-0 border border-input bg-background px-2 text-sm disabled:opacity-60"
            >
              <option value="obligation">Obligation</option>
              <option value="deadline">Deadline</option>
              <option value="renewal">Renewal</option>
              <option value="custom">Note</option>
            </select>
            <button
              type="button"
              onClick={() => void watch()}
              disabled={busy || watchTitle.trim().length < 5 || !watchAuditId}
              className="h-9 shrink-0 bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy ? "Watching…" : "Watch"}
            </button>
          </div>
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-4" aria-label="Filter watched items">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              "border px-2.5 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-foreground bg-muted font-semibold text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading watched items…</p>
      ) : empty ? (
        <div className="border border-dashed px-4 py-12 text-center">
          <CalendarClock className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Nothing being tracked</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Obligations, renewals, and deadlines from your signed deals appear here with due dates.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {overdueObligations.length > 0 && (
            <section aria-label="Overdue">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive">Overdue</p>
              <ul className="mt-1.5 space-y-1.5">
                {overdueObligations.map((o) => (
                  <ObligationRow key={o.id} item={o} overdue rowBusy={rowBusy} onResolve={(s) => void resolve(o.id, o.auditId, s)} />
                ))}
              </ul>
            </section>
          )}

          {upcomingObligations.length > 0 && (
            <section aria-label="Upcoming">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Upcoming</p>
              <ul className="mt-1.5 space-y-1.5">
                {upcomingObligations.map((o) => (
                  <ObligationRow key={o.id} item={o} overdue={false} rowBusy={rowBusy} onResolve={(s) => void resolve(o.id, o.auditId, s)} />
                ))}
              </ul>
            </section>
          )}

          {showDeadlines && lapsedDeadlines.length > 0 && (
            <section aria-label="Lapsed signing links">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive">Signing links lapsed</p>
              <ul className="mt-1.5 space-y-1.5">
                {lapsedDeadlines.map((d) => (
                  <DeadlineRow key={d.signerId} item={d} lapsed copied={copied} onCopied={(id) => setCopied(id)} />
                ))}
              </ul>
            </section>
          )}

          {showDeadlines && openDeadlines.length > 0 && (
            <section aria-label="Signing deadlines">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Signing deadlines</p>
              <ul className="mt-1.5 space-y-1.5">
                {openDeadlines.map((d) => (
                  <DeadlineRow key={d.signerId} item={d} lapsed={false} copied={copied} onCopied={(id) => setCopied(id)} />
                ))}
              </ul>
            </section>
          )}

          {showConflicts && (conflicts ?? []).length > 0 && (
            <section aria-label="Cross-contract conflicts">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cross-contract conflicts</p>
              <ul className="mt-1.5 space-y-1.5">
                {(conflicts ?? []).map((c) => (
                  <li key={c.auditId} className="border border-border bg-background px-3.5 py-3">
                    <p className="text-sm font-medium">
                      {c.threadId ? (
                        <Link href={`/chat/${c.threadId}`} className="hover:underline">{c.dealTitle}</Link>
                      ) : (
                        c.dealTitle
                      )}
                      <span className="ml-2 text-[11px] font-normal tabular-nums text-muted-foreground">
                        {c.conflicts.length} conflict{c.conflicts.length === 1 ? "" : "s"} with your other deals
                      </span>
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {c.conflicts.slice(0, 3).map((item, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{item.clauseTitle}</span> — {item.message}
                        </li>
                      ))}
                      {c.conflicts.length > 3 && (
                        <li className="text-[11px] text-muted-foreground">+{c.conflicts.length - 3} more in the deal workspace</li>
                      )}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Extracted dates carry their provenance — approximate ones deserve a calendar check. Signing links are managed in the Signing tab.
      </p>
    </div>
  )
}

function ObligationRow({ item, overdue, rowBusy, onResolve }: {
  item: KeeperObligation
  overdue: boolean
  rowBusy: string | null
  onResolve: (status: "completed" | "dismissed") => void
}) {
  return (
    <li className="flex items-center gap-2 border border-border bg-background px-3.5 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {item.threadId ? (
            <Link href={`/chat/${item.threadId}`} className="hover:underline">{item.dealTitle}</Link>
          ) : (
            item.dealTitle
          )}{" "}· {item.eventType.replaceAll("_", " ")} · {item.provenance}
        </span>
      </span>
      <span className={cn("shrink-0 text-[11px] tabular-nums", overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
        {formatDue(item.dueDate)}
      </span>
      <button
        type="button"
        onClick={() => onResolve("completed")}
        disabled={rowBusy !== null}
        aria-label={`Mark done: ${item.title}`}
        title="Done"
        className="shrink-0 p-1 text-muted-foreground hover:text-pine-700 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onResolve("dismissed")}
        disabled={rowBusy !== null}
        aria-label={`Dismiss: ${item.title}`}
        title="Dismiss"
        className="shrink-0 p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

function DeadlineRow({ item, lapsed, copied, onCopied }: {
  item: KeeperDeadline
  lapsed: boolean
  copied: string | null
  onCopied: (id: string) => void
}) {
  return (
    <li className="flex items-center gap-2 border border-border bg-background px-3.5 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.signerName} <span className="font-normal text-muted-foreground">· {item.signerEmail}</span></span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.dealTitle}</span>
      </span>
      <span className={cn("shrink-0 text-[11px] tabular-nums", lapsed ? "font-semibold text-destructive" : "text-muted-foreground")}>
        {item.status === "expired" || lapsed ? `Expired ${formatDateTime(item.expiresAt)}` : `Expires ${formatDateTime(item.expiresAt)}`}
      </span>
      <button
        type="button"
        onClick={() => copyLink(item.link, () => onCopied(item.signerId))}
        aria-label={`Copy signing link for ${item.signerName}`}
        className="flex shrink-0 items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        {copied === item.signerId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        <span className="text-[11px]">{copied === item.signerId ? "Copied" : "Copy link"}</span>
      </button>
      <Link href="/signing" className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground">
        Manage
      </Link>
    </li>
  )
}
