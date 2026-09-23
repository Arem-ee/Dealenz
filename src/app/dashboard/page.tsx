import { createClient } from "@/lib/supabase/server"
import { listThreads } from "@/lib/chat/actions"
import { ChatLanding } from "@/components/chat/ChatLanding"
import { selectDueEvents } from "@/lib/monitoring/reminders"
import { bucketActivityByDay } from "@/lib/activity/week"
import { summarizePortfolio } from "@/lib/dashboard/summary"

export const dynamic = "force-dynamic"

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

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div />

  // Surface load failures honestly in the landing instead of pretending the
  // user has no threads.
  let threads: Awaited<ReturnType<typeof listThreads>> = []
  let loadError: string | null = null
  try {
    threads = await listThreads()
  } catch (err) {
    loadError = err instanceof Error && err.message ? err.message : "Please refresh and try again."
  }

  // Portfolio aggregates derive purely from thread rows (infallible), so a
  // failed activity query hides the week strip, never the tiles or table.
  // Previously one try block covered both: a failed activity query nulled
  // the portfolio and blanked the whole dashboard for users with deals.
  const portfolio: PortfolioSummary = summarizePortfolio(threads)
  let weekBuckets: ReturnType<typeof bucketActivityByDay> = []
  try {
    const { data: activity } = await supabase
      .from("activity_events")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500)
    const nowIso = new Date().toISOString()
    weekBuckets = bucketActivityByDay(((activity ?? []) as Array<{ created_at?: unknown }>) ?? [], nowIso)
  } catch {
    weekBuckets = []
  }

  // Portfolio strip: real counts plus due-soon deadlines. Each query is
  // user-scoped and best-effort — a failed query hides its block, never
  // the composer.
  let deadlines: DeadlineItem[] = []
  const executedAuditIds: string[] = []
  const signingAuditIds: string[] = []
  let monitoredAuditIds: string[] = []
  try {
    const [events] = await Promise.all([
      supabase
        .from("monitoring_events")
        .select("id, audit_id, title, due_date, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(200),
    ])
    const rows = ((events.data ?? []) as Array<{ id: string; audit_id: string; title: string; due_date: string | null; status: string }>).map((e) => ({
      id: String(e.id),
      user_id: user.id,
      audit_id: String(e.audit_id),
      title: String(e.title ?? "Deadline"),
      due_date: e.due_date,
      status: String(e.status),
    }))
    monitoredAuditIds = [...new Set(rows.map((r) => r.audit_id))]
    const due = selectDueEvents(rows, new Date().toISOString()).slice(0, 5)
    if (due.length > 0 || monitoredAuditIds.length > 0) {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, attached_audit_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100)
      const threadByAudit = new Map<string, string>()
      for (const c of ((convs ?? []) as Array<{ id: string; attached_audit_id: string | null }>)) {
        if (c.attached_audit_id && !threadByAudit.has(c.attached_audit_id)) {
          threadByAudit.set(c.attached_audit_id, c.id)
        }
      }
      deadlines = due.map((d) => ({
        id: d.id,
        auditId: d.audit_id,
        title: d.title,
        dueDate: d.due_date as string,
        href: threadByAudit.has(d.audit_id) ? `/chat/${threadByAudit.get(d.audit_id)}` : `/document/${d.audit_id}`,
      }))
    }
    // Signing posture per audit for deal-moment derivation (one query for
    // the visible threads; best-effort like everything else here).
    try {
      const threadAuditIds = [...new Set(threads.map((t) => t.auditId).filter((id): id is string => !!id))]
      if (threadAuditIds.length > 0) {
        const { data: signerRows } = await supabase
          .from("document_signers")
          .select("audit_id, status")
          .in("audit_id", threadAuditIds)
          .limit(200)
        const byAudit = new Map<string, string[]>()
        for (const s of ((signerRows ?? []) as Array<{ audit_id: string; status: string }>)) {
          const list = byAudit.get(String(s.audit_id)) ?? []
          list.push(String(s.status))
          byAudit.set(String(s.audit_id), list)
        }
        for (const [auditId, statuses] of byAudit) {
          if (statuses.length > 0) signingAuditIds.push(auditId)
          if (statuses.length > 0 && statuses.every((s) => s === "signed")) executedAuditIds.push(auditId)
        }
      }
    } catch {
      // Deal moments fall back to analysis-derived states.
    }
  } catch {
    // Portfolio blocks stay hidden; the composer below always works.
  }

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col bg-background md:h-[calc(100dvh-3.5rem)]">
      <ChatLanding
        threads={threads}
        loadError={loadError}
        deadlines={deadlines}
        executedAuditIds={executedAuditIds}
        signingAuditIds={signingAuditIds}
        monitoredAuditIds={monitoredAuditIds}
        portfolio={portfolio}
        week={weekBuckets}
      />
    </div>
  )
}
