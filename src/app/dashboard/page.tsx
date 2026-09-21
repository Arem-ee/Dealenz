import { createClient } from "@/lib/supabase/server"
import { listThreads } from "@/lib/chat/actions"
import { ChatLanding } from "@/components/chat/ChatLanding"
import { selectDueEvents } from "@/lib/monitoring/reminders"

export const dynamic = "force-dynamic"

export interface DeadlineItem {
  id: string
  title: string
  dueDate: string
  href: string
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

  // Portfolio strip: real counts plus due-soon deadlines. Each query is
  // user-scoped and best-effort — a failed query hides its block, never
  // the composer.
  let dealCount: number | null = null
  let analyzedCount: number | null = null
  let deadlines: DeadlineItem[] = []
  try {
    const [deals, analyzed, events] = await Promise.all([
      supabase.from("audits").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("audits").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "analyzed"),
      supabase
        .from("monitoring_events")
        .select("id, audit_id, title, due_date, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .limit(50),
    ])
    if (typeof deals.count === "number") dealCount = deals.count
    if (typeof analyzed.count === "number") analyzedCount = analyzed.count
    const rows = ((events.data ?? []) as Array<{ id: string; audit_id: string; title: string; due_date: string | null; status: string }>).map((e) => ({
      id: String(e.id),
      user_id: user.id,
      audit_id: String(e.audit_id),
      title: String(e.title ?? "Deadline"),
      due_date: e.due_date,
      status: String(e.status),
    }))
    const due = selectDueEvents(rows, new Date().toISOString()).slice(0, 5)
    if (due.length > 0) {
      const auditIds = [...new Set(due.map((d) => d.audit_id))]
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, attached_audit_id")
        .eq("user_id", user.id)
        .in("attached_audit_id", auditIds)
        .order("created_at", { ascending: false })
      const threadByAudit = new Map<string, string>()
      for (const c of ((convs ?? []) as Array<{ id: string; attached_audit_id: string | null }>)) {
        if (c.attached_audit_id && !threadByAudit.has(c.attached_audit_id)) {
          threadByAudit.set(c.attached_audit_id, c.id)
        }
      }
      deadlines = due.map((d) => ({
        id: d.id,
        title: d.title,
        dueDate: d.due_date as string,
        href: threadByAudit.has(d.audit_id) ? `/chat/${threadByAudit.get(d.audit_id)}` : `/document/${d.audit_id}`,
      }))
    }
  } catch {
    // Portfolio blocks stay hidden; the composer below always works.
  }

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col bg-background md:h-[calc(100dvh-3.5rem)]">
      <ChatLanding
        threads={threads}
        loadError={loadError}
        stats={dealCount !== null || analyzedCount !== null ? { deals: dealCount, analyzed: analyzedCount } : null}
        deadlines={deadlines}
      />
    </div>
  )
}
