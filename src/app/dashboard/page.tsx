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
  const threadAuditIds = [...new Set(threads.map((t) => t.auditId).filter((id): id is string => !!id))]

  // One parallel batch for the four independent reads (activity, monitoring
  // events, signer posture, profile): previously five serial roundtrips.
  // allSettled keeps the per-block failure isolation — each failure hides
  // its own block, never the dashboard.
  const [activitySettled, eventsSettled, signersSettled, profileSettled] = await Promise.allSettled([
    supabase
      .from("activity_events")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("monitoring_events")
      .select("id, audit_id, title, due_date, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true })
      .limit(200),
    threadAuditIds.length > 0
      ? supabase.from("document_signers").select("audit_id, status").in("audit_id", threadAuditIds).limit(200)
      : Promise.resolve({ data: [] as Array<{ audit_id: string; status: string }> }),
    supabase.from("business_profiles").select("id").eq("user_id", user.id).maybeSingle(),
  ])

  let weekBuckets: ReturnType<typeof bucketActivityByDay> = []
  if (activitySettled.status === "fulfilled") {
    const activity = (activitySettled.value as { data?: Array<{ created_at?: unknown }> | null }).data
    weekBuckets = bucketActivityByDay((activity ?? []) ?? [], new Date().toISOString())
  }

  // Portfolio strip: real counts plus due-soon deadlines. Each query is
  // user-scoped and best-effort — a failed query hides its block, never
  // the composer.
  let deadlines: DeadlineItem[] = []
  const executedAuditIds: string[] = []
  const signingAuditIds: string[] = []
  let monitoredAuditIds: string[] = []
  if (eventsSettled.status === "fulfilled") {
    const eventsData = (eventsSettled.value as { data?: Array<{ id: string; audit_id: string; title: string; due_date: string | null; status: string }> | null }).data
    const rows = ((eventsData ?? []) as Array<{ id: string; audit_id: string; title: string; due_date: string | null; status: string }>).map((e) => ({
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
    // Signing posture per audit for deal-moment derivation (best-effort like
    // everything else here).
    if (signersSettled.status === "fulfilled") {
      const signerRows = (signersSettled.value as { data?: Array<{ audit_id: string; status: string }> | null }).data
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
  }

  // First-run nudge: no business profile yet means documents render
  // without a letterhead and jurisdiction gets re-asked per deal. Best
  // effort — a failed check hides the banner, never the dashboard.
  const setupNeeded =
    profileSettled.status === "fulfilled"
      ? !(profileSettled.value as { data?: { id?: string } | null }).data
      : false

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-background">
      <ChatLanding
        threads={threads}
        loadError={loadError}
        deadlines={deadlines}
        executedAuditIds={executedAuditIds}
        signingAuditIds={signingAuditIds}
        monitoredAuditIds={monitoredAuditIds}
        portfolio={portfolio}
        week={weekBuckets}
        setupNeeded={setupNeeded}
      />
    </div>
  )
}
