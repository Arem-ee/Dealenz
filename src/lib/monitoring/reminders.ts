// Deadline-reminder automation (P3 stay-guarded core): once a day, active
// monitoring events due soon (or recently overdue) get an alert row for the
// owner's email, sent when Gmail is connected. Every step is idempotent
// (alert rows dedupe by event+destination+due date; sent rows never resend)
// and honest: without connected Gmail the alert stays pending and visible
// instead of claiming delivery.

export interface ReminderEvent {
  id: string
  user_id: string
  audit_id: string
  title: string
  due_date: string | null
  status: string
}

function dayString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Pure selection: active events with a real due date inside
// [today - overdueLookbackDays, today + windowDays]. Null dates can never
// be scheduled, so they are excluded — unknown stays unknown.
export function selectDueEvents(
  events: ReminderEvent[],
  nowIso: string,
  windowDays = 7,
  overdueLookbackDays = 30
): ReminderEvent[] {
  const today = dayString(new Date(nowIso))
  const end = new Date(today + "T00:00:00Z")
  end.setUTCDate(end.getUTCDate() + windowDays)
  const endStr = dayString(end)
  const start = new Date(today + "T00:00:00Z")
  start.setUTCDate(start.getUTCDate() - overdueLookbackDays)
  const startStr = dayString(start)
  return (events ?? []).filter(
    (e) =>
      e &&
      e.status === "active" &&
      typeof e.due_date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.due_date) &&
      e.due_date >= startStr &&
      e.due_date <= endStr
  )
}

export interface ReminderDeps {
  listDueEvents: () => Promise<ReminderEvent[]>
  getUserEmail: (userId: string) => Promise<{ email: string | null; verified: boolean }>
  hasGmail: (userId: string) => Promise<boolean>
  ensureAlert: (event: ReminderEvent, destination: string) => Promise<{ id: string; status: string }>
  sendAlert: (alertId: string, userId: string) => Promise<{ sent: boolean }>
  log: (entry: { userId: string; auditId: string; ok: boolean; detail: string }) => Promise<void>
}

export interface ReminderOutcome {
  checked: number
  alerted: number
  sent: number
  failed: number
  skipped: number
}

// Runs one reminder pass over already-selected due events. Never throws:
// per-event failures are counted, and the run always reports counts.
export async function runDeadlineReminders(deps: ReminderDeps, events: ReminderEvent[]): Promise<ReminderOutcome> {
  const outcome: ReminderOutcome = { checked: events.length, alerted: 0, sent: 0, failed: 0, skipped: 0 }
  for (const event of events) {
    try {
      const identity = await deps.getUserEmail(event.user_id).catch(() => null)
      const destination = identity?.email ?? null
      if (!destination || identity?.verified !== true) {
        outcome.skipped += 1
        continue
      }
      const alert = await deps.ensureAlert(event, destination)
      if (alert.status === "sent") {
        outcome.skipped += 1
        continue
      }
      outcome.alerted += 1
      const connected = await deps.hasGmail(event.user_id).catch(() => false)
      if (!connected) {
        // Pending and visible in monitoring; delivery waits for Gmail.
        await deps.log({ userId: event.user_id, auditId: event.audit_id, ok: true, detail: `reminder pending (no Gmail): ${event.id}` }).catch(() => null)
        continue
      }
      const sent = await deps.sendAlert(alert.id, event.user_id)
      if (sent.sent) {
        outcome.sent += 1
        await deps.log({ userId: event.user_id, auditId: event.audit_id, ok: true, detail: `reminder sent: ${event.id}` }).catch(() => null)
      } else {
        outcome.failed += 1
      }
    } catch {
      outcome.failed += 1
    }
  }
  return outcome
}
