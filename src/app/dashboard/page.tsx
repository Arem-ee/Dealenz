import { createClient } from "@/lib/supabase/server"
import { listThreads } from "@/lib/chat/actions"
import { ChatLanding } from "@/components/chat/ChatLanding"
import { selectDueEvents } from "@/lib/monitoring/reminders"

export const dynamic = "force-dynamic"

export interface DeadlineItem {
  id: string
  auditId: string
  title: string
  dueDate: string
  href: string
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const [userSettled, threadsSettled] = await Promise.allSettled([
    supabase.auth.getUser(),
    listThreads(),
  ])
  const user = userSettled.status === "fulfilled" ? userSettled.value.data.user : null
  if (!user) return <div />

  let threads: Awaited<ReturnType<typeof listThreads>> = []
  let loadError: string | null = null
  if (threadsSettled.status === "fulfilled") {
    threads = threadsSettled.value
  } else {
    const err = threadsSettled.reason
    loadError = err instanceof Error && err.message ? err.message : "Please refresh and try again."
  }

  const [eventsSettled, profileSettled] = await Promise.allSettled([
    supabase
      .from("monitoring_events")
      .select("id, audit_id, title, due_date, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true })
      .limit(200),
    supabase.from("business_profiles").select("id").eq("user_id", user.id).maybeSingle(),
  ])

  let deadlines: DeadlineItem[] = []
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
    const threadByAudit = new Map<string, string>()
    for (const t of threads) {
      if (t.auditId && !threadByAudit.has(t.auditId)) {
        threadByAudit.set(t.auditId, t.id)
      }
    }
    deadlines = selectDueEvents(rows, new Date().toISOString()).slice(0, 5).map((d) => ({
      id: d.id,
      auditId: d.audit_id,
      title: d.title,
      dueDate: d.due_date as string,
      href: threadByAudit.has(d.audit_id) ? `/chat/${threadByAudit.get(d.audit_id)}` : `/document/${d.audit_id}`,
    }))
  }

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
        setupNeeded={setupNeeded}
      />
    </div>
  )
}
