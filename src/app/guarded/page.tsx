import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { StandaloneContractForm } from "@/components/signing/standalone-contract-form"
import { EventStatusButtons } from "@/components/tracker/event-actions"

export const dynamic = "force-dynamic"

interface GuardedDeal {
  auditId: string
  title: string
  dealType: string | null
  signedAt: string | null
  nextTitle: string | null
  nextDue: string | null
  nextType: string | null
  obligationCount: number
  obligations: Array<{ id: string; title: string; due: string; type: string | null; quote: string | null }>
  threadId: string | null
}

interface ClearedDeal {
  auditId: string
  title: string
  items: Array<{ id: string; title: string; due: string | null; status: string }>
}

function typeLabel(t: string | null): string | null {
  if (t === "renewal") return "Renewal"
  if (t === "expiration") return "Ends"
  if (t === "notice_period") return "Notice"
  if (t === "payment_due") return "Payment"
  return null
}

function urgencyRank(due: string | null, today: string): number {
  if (!due) return 3
  if (due < today) return 0
  const days = Math.floor((new Date(due + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86400000)
  if (days <= 30) return 1
  return 2
}

// Tracker: everything after signing that requires watching. Signed audits
// with their next deadline each, newest-signing first. Deals with nothing
// dated say so honestly instead of inventing urgency.
export default async function GuardedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  let deals: GuardedDeal[] = []
  let cleared: ClearedDeal[] = []
  let loadError: string | null = null
  try {
    const { data: versions } = await supabase
      .from("document_versions")
      .select("id, audit_id, version_number, fully_signed_at, locked_at, created_at")
      .eq("user_id", user.id)
      .in("status", ["fully_signed", "locked"])
      .order("created_at", { ascending: false })
      .limit(100)
    const latestByAudit = new Map<string, { id: string; signedAt: string | null }>()
    for (const v of ((versions ?? []) as Array<{ id: string; audit_id: string; fully_signed_at: string | null; locked_at: string | null; created_at: string }>)) {
      const auditId = String(v.audit_id)
      if (!latestByAudit.has(auditId)) {
        latestByAudit.set(auditId, { id: String(v.id), signedAt: v.fully_signed_at ?? v.locked_at ?? v.created_at ?? null })
      }
    }
    const auditIds = [...latestByAudit.keys()]
    if (auditIds.length > 0) {
      const [{ data: audits }, { data: events }, { data: convs }] = await Promise.all([
        supabase.from("audits").select("id, title, deal_type").eq("user_id", user.id).in("id", auditIds),
        supabase
          .from("monitoring_events")
          .select("id, audit_id, title, due_date, event_type, status, evidence")
          .eq("user_id", user.id)
          .in("status", ["active", "completed", "dismissed"])
          .in("audit_id", auditIds)
          .order("due_date", { ascending: true })
          .limit(200),
        supabase
          .from("conversations")
          .select("id, attached_audit_id, created_at")
          .eq("user_id", user.id)
          .in("attached_audit_id", auditIds)
          .order("created_at", { ascending: false }),
      ])
      const auditMap = new Map(((audits ?? []) as Array<{ id: string; title: string; deal_type: string | null }>).map((a) => [String(a.id), a]))
      const nextByAudit = new Map<string, { title: string; due: string; type: string | null }>()
      const obligationsByAudit = new Map<string, Array<{ id: string; title: string; due: string; type: string | null; quote: string | null }>>()
      const clearedByAudit = new Map<string, Array<{ id: string; title: string; due: string | null; status: string }>>()
      for (const e of ((events ?? []) as Array<{ id: string; audit_id: string; title: string; due_date: string | null; event_type: string | null; status: string; evidence: Record<string, unknown> | null }>)) {
        const aid = String(e.audit_id)
        const status = String(e.status ?? "active")
        if (status !== "active") {
          const list = clearedByAudit.get(aid) ?? []
          list.push({ id: String(e.id), title: String(e.title ?? "Obligation"), due: e.due_date ? String(e.due_date) : null, status })
          clearedByAudit.set(aid, list)
          continue
        }
        const quote = e.evidence && typeof e.evidence.quote === "string" && e.evidence.quote.trim() ? e.evidence.quote.slice(0, 160) : null
        const entry = { id: String(e.id), title: String(e.title ?? "Obligation"), due: e.due_date ? String(e.due_date) : "", type: typeof e.event_type === "string" ? e.event_type : null, quote }
        const list = obligationsByAudit.get(aid) ?? []
        list.push(entry)
        obligationsByAudit.set(aid, list)
        if (!nextByAudit.has(aid) && e.due_date) {
          nextByAudit.set(aid, { ...entry, due: String(e.due_date) })
        }
      }
      const threadByAudit = new Map<string, string>()
      for (const c of ((convs ?? []) as Array<{ id: string; attached_audit_id: string | null }>)) {
        if (c.attached_audit_id && !threadByAudit.has(c.attached_audit_id)) {
          threadByAudit.set(c.attached_audit_id, c.id)
        }
      }
      deals = auditIds
        .map((auditId) => {
          const audit = auditMap.get(auditId)
          if (!audit) return null
          const next = nextByAudit.get(auditId) ?? null
          const threadId = threadByAudit.get(auditId) ?? null
          const obligations = obligationsByAudit.get(auditId) ?? []
          return {
            auditId,
            title: String(audit.title || "Untitled deal"),
            dealType: audit.deal_type,
            signedAt: latestByAudit.get(auditId)?.signedAt ?? null,
            nextTitle: next?.title ?? null,
            nextDue: next?.due ?? null,
            nextType: next?.type ?? null,
            obligationCount: obligations.length,
            obligations: obligations.slice(0, 10),
            threadId,
          }
        })
        .filter((d): d is GuardedDeal => d !== null)
      // Urgency first: overdue, due within 30 days, later, then no date.
      // Signing recency buries overdue deals; urgency never does.
      const todayKey = new Date().toISOString().slice(0, 10)
      deals.sort((a, b) => urgencyRank(a.nextDue, todayKey) - urgencyRank(b.nextDue, todayKey))
      cleared = [...clearedByAudit.entries()]
        .map(([auditId, items]) => {
          const audit = auditMap.get(auditId)
          if (!audit || items.length === 0) return null
          return { auditId, title: String(audit.title || "Untitled deal"), items: items.slice(0, 20) }
        })
        .filter((d): d is ClearedDeal => d !== null)
    }
  } catch {
    loadError = "We couldn't load tracked deals. Please try again."
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">After signing</p>
      <h1 className="mt-1.5  text-[28px] font-semibold leading-tight tracking-[-0.01em]">Tracker</h1>

      {loadError ? (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center" role="alert">
          <p className="text-sm font-medium">{loadError}</p>
          <Link href="/guarded" className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90">
            Retry
          </Link>
        </div>
      ) : deals.length === 0 ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm font-medium">Nothing tracked yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Signed deals land here with their next deadlines. Review a deal, push back, and sign — this page fills itself.
            </p>
            <Link href="/dashboard" className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90">
              Go to deals
            </Link>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Already signed somewhere else?</p>
            <StandaloneContractForm mode="track" />
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Next things that matter
          </p>
          {(() => {
            const todayKey = new Date().toISOString().slice(0, 10)
            const overdue = deals.filter((d) => !!d.nextDue && d.nextDue < todayKey).length
            const dueSoon = deals.filter((d) => {
              if (!d.nextDue || d.nextDue < todayKey) return false
              const days = Math.floor((new Date(d.nextDue + "T00:00:00Z").getTime() - new Date(todayKey + "T00:00:00Z").getTime()) / 86400000)
              return days <= 30
            }).length
            return (
              <p className="px-2 pb-2 text-[11px] text-muted-foreground" aria-live="polite">
                {deals.length} tracked deal{deals.length === 1 ? "" : "s"}
                {overdue > 0 ? ` · ${overdue} overdue` : ""}{dueSoon > 0 ? ` · ${dueSoon} due within 30 days` : ""}.
              </p>
            )
          })()}
          <ul className="space-y-2.5">
            {deals.map((d) => {
              const href = d.threadId ? `/chat/${d.threadId}` : `/document/${d.auditId}`
              const todayKey = new Date().toISOString().slice(0, 10)
              const overdue = !!d.nextDue && d.nextDue < todayKey
              const dueDays = d.nextDue && !overdue
                ? Math.floor((new Date(d.nextDue + "T00:00:00Z").getTime() - new Date(todayKey + "T00:00:00Z").getTime()) / 86400000)
                : null
              const kind = typeLabel(d.nextType)
              const notice = (d.nextType === "renewal" || d.nextType === "expiration") && d.nextDue
                ? d.obligations.find((o) => o.type === "notice_period" && o.due && o.due <= (d.nextDue as string)) ?? null
                : null
              return (
                <li key={d.auditId} className="rounded-xl border border-border/60 bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate  text-[15px] font-semibold leading-snug">{d.title}</p>
                    <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-1.5 py-px text-[10px] font-medium text-emerald-700">
                      Signed{d.signedAt ? ` · ${new Date(d.signedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                    </span>
                  </div>
                  {d.nextDue ? (
                    <div className="mt-1.5 flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                        Next{kind ? ` (${kind})` : ""}: <span className="font-medium text-foreground">{d.nextTitle}</span> ·{" "}
                        {notice && (
                          <span className="font-medium tabular-nums text-foreground">
                            Notice by {new Date(notice.due + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                          </span>
                        )}
                        <span className={`font-medium tabular-nums ${overdue ? "font-bold text-foreground" : ""}`}>
                          {overdue ? "Overdue · " : dueDays !== null ? `Due in ${dueDays}d · ` : ""}{new Date(d.nextDue + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </p>
                      {d.obligations[0] && (
                        <EventStatusButtons auditId={d.auditId} eventId={d.obligations[0].id} status="active" />
                      )}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {d.obligationCount > 0
                        ? `${d.obligationCount} tracked obligation${d.obligationCount === 1 ? "" : "s"}, none dated — add due dates in monitoring.`
                        : "No dated obligations tracked — add deadlines in monitoring."}
                    </p>
                  )}
                  {d.obligations.length > 1 && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                        All {d.obligations.length} tracked obligations
                      </summary>
                      <ul className="mt-1.5 space-y-2 border-l-2 border-border pl-3">
                        {d.obligations.slice(1).map((o) => {
                          const label = typeLabel(o.type)
                          return (
                            <li key={o.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span className="min-w-0 flex-1">
                                <span className="font-medium text-foreground">{o.title}</span>
                                {label ? ` · ${label}` : ""} · {o.due ? new Date(o.due + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "no date"}
                                {o.quote && (
                                  <span className="mt-0.5 block truncate italic">
                                    “{o.quote}”{" "}
                                    <Link href={href} className="font-semibold not-italic text-primary hover:underline">
                                      source
                                    </Link>
                                  </span>
                                )}
                              </span>
                              <EventStatusButtons auditId={d.auditId} eventId={o.id} status="active" />
                            </li>
                          )
                        })}
                      </ul>
                    </details>
                  )}
                  <div className="mt-2">
                    <Link href={href} className="text-xs font-semibold text-primary hover:underline">
                      Open →
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
          {cleared.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">
                Cleared · {cleared.reduce((s, c) => s + c.items.length, 0)}
              </summary>
              <ul className="mt-2 space-y-2.5">
                {cleared.map((c) => (
                  <li key={c.auditId} className="rounded-xl border border-border/60 bg-card p-3.5">
                    <p className="truncate text-[13px] font-semibold">{c.title}</p>
                    <ul className="mt-1.5 space-y-2">
                      {c.items.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="min-w-0 flex-1">
                            <span className="font-medium text-foreground line-through">{item.title}</span>
                            {` · ${item.status}`}{item.due ? ` · ${new Date(item.due + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                          </span>
                          <EventStatusButtons auditId={c.auditId} eventId={item.id} status={item.status === "completed" ? "completed" : "dismissed"} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
    </div>
  )
}
