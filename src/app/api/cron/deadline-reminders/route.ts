import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { runDeadlineReminders, selectDueEvents, type ReminderDeps, type ReminderEvent } from "@/lib/monitoring/reminders"

// Daily stay-guarded pass: active monitoring events due soon (or recently
// overdue) get an alert row for the owner's verified email, sent when Gmail
// is connected. Same auth contract as the retry cron (CRON_SECRET bearer;
// open in development when unset). Idempotent per run and across runs:
// alert rows dedupe by event+destination+due date, sent rows never resend.

export const dynamic = "force-dynamic"

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  if (!cronSecret) return true
  return auth === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: "Service not configured" }, { status: 500 })

  const svc = createClient(url, key)

  const nowIso = new Date().toISOString()
  const { data: rows, error } = await svc
    .from("monitoring_events")
    .select("id, user_id, audit_id, title, due_date, status")
    .eq("status", "active")
    .not("due_date", "is", null)
    .order("due_date", { ascending: true })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const due = selectDueEvents(((rows ?? []) as ReminderEvent[]), nowIso)

  const deps: ReminderDeps = {
    listDueEvents: async () => due,
    getUserEmail: async (userId: string) => {
      const { data, error: userError } = await svc.auth.admin.getUserById(userId)
      if (userError || !data?.user) return { email: null, verified: false }
      return { email: data.user.email ?? null, verified: !!data.user.email_confirmed_at }
    },
    hasGmail: async (userId: string) => {
      const { getGmailTokens } = await import("@/lib/gmail/tokens")
      const tokens = await getGmailTokens(svc as never, userId).catch(() => null)
      return tokens !== null
    },
    ensureAlert: async (event: ReminderEvent, destination: string) => {
      const { createMonitoringAlert } = await import("@/lib/monitoring/store")
      return createMonitoringAlert(svc as never, event.user_id, {
        monitoringEventId: event.id,
        auditId: event.audit_id,
        destination,
        provider: "gmail",
      })
    },
    sendAlert: async (alertId: string, userId: string) => {
      const { sendMonitoringAlert } = await import("@/lib/monitoring/store")
      return sendMonitoringAlert(svc as never, userId, alertId)
    },
    log: async (entry: { userId: string; auditId: string; ok: boolean; detail: string }) => {
      await svc.from("system_logs").insert({
        user_id: entry.userId,
        audit_id: entry.auditId,
        phase: "reminder",
        status: entry.ok ? "success" : "failure",
        error_message: entry.detail.slice(0, 500),
      })
    },
  }

  const outcome = await runDeadlineReminders(deps, due)
  return NextResponse.json({ ok: true, ...outcome })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
