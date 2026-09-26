import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

interface GuardedDeal {
  auditId: string
  title: string
  dealType: string | null
  signedAt: string | null
  nextTitle: string | null
  nextDue: string | null
  threadId: string | null
}

// Tracker: everything after signing that requires watching. Signed audits
// with their next deadline each, newest-signing first. Deals with nothing
// dated say so honestly instead of inventing urgency.
export default async function GuardedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  let deals: GuardedDeal[] = []
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
          .select("audit_id, title, due_date")
          .eq("user_id", user.id)
          .eq("status", "active")
          .in("audit_id", auditIds)
          .not("due_date", "is", null)
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
      const nextByAudit = new Map<string, { title: string; due: string }>()
      for (const e of ((events ?? []) as Array<{ audit_id: string; title: string; due_date: string | null }>)) {
        const aid = String(e.audit_id)
        if (!nextByAudit.has(aid) && e.due_date) {
          nextByAudit.set(aid, { title: String(e.title ?? "Obligation"), due: String(e.due_date) })
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
          return {
            auditId,
            title: String(audit.title || "Untitled deal"),
            dealType: audit.deal_type,
            signedAt: latestByAudit.get(auditId)?.signedAt ?? null,
            nextTitle: next?.title ?? null,
            nextDue: next?.due ?? null,
            threadId,
          }
        })
        .filter((d): d is GuardedDeal => d !== null)
    }
  } catch {
    deals = []
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--burgundy)]">After signing</p>
      <h1 className="mt-1.5  text-[28px] font-semibold leading-tight tracking-[-0.01em]">Tracker</h1>

      {deals.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium">Nothing tracked yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Signed deals land here with their next deadlines. Review a deal, push back, and sign — this page fills itself.
          </p>
          <Link href="/dashboard" className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90">
            Go to deals
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Next things that matter
          </p>
          <ul className="space-y-2.5">
            {deals.map((d) => {
              const href = d.threadId ? `/chat/${d.threadId}` : `/document/${d.auditId}`
              const overdue = d.nextDue
                ? new Date(d.nextDue + "T00:00:00Z").getTime() < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()
                : false
              return (
                <li key={d.auditId} className="rounded-xl border border-border/60 bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate  text-[15px] font-semibold leading-snug">{d.title}</p>
                    <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-1.5 py-px text-[10px] font-medium text-emerald-700">
                      Signed{d.signedAt ? ` · ${new Date(d.signedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                    </span>
                  </div>
                  {d.nextDue ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Next: <span className="font-medium text-foreground">{d.nextTitle}</span> ·{" "}
                      <span className={`font-medium tabular-nums ${overdue ? "text-red-700" : ""}`}>
                        {overdue ? "Overdue · " : ""}{new Date(d.nextDue + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground">No dated obligations tracked — add deadlines in monitoring.</p>
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
        </div>
      )}
    </div>
    </div>
  )
}
