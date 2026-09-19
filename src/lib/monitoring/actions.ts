"use server"

import { createClient } from "@/lib/supabase/server"
import { toActionFailure } from "@/lib/action-result"
import {
  createMonitoringAlert,
  createMonitoringEvent,
  listMonitoringEvents,
  sendMonitoringAlert,
} from "./store"
import type { MonitoringAlertInput, MonitoringEventInput } from "./schema"

// Server boundary for the monitoring workspace. Auth + ownership enforced
// here and in RLS; the client never touches tokens or other users' rows.
//
// Email-verification policy (P0-3): creating events/alerts and sending alerts
// are consequential (monitoring state for signed deals + external email), so
// they require a verified email like analyzeDeal/generate/Ask. The read-only
// getMonitoringState stays available pre-verification: own rows only.

const VERIFY_REQUIRED_ERROR = "Please verify your email address before using this feature."

export async function getMonitoringState(auditId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const events = await listMonitoringEvents(supabase as never, user.id, auditId)
    const { data: alerts } = await supabase
      .from("monitoring_alerts")
      .select("id, monitoring_event_id, destination, status, provider, sent_at")
      .eq("audit_id", auditId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
    const { getGmailTokens } = await import("@/lib/gmail/tokens")
    const tokens = await getGmailTokens(supabase as never, user.id).catch(() => null)
    return {
      ok: true as const,
      events,
      alerts: (alerts as Array<Record<string, unknown>>) ?? [],
      gmailConnected: tokens !== null,
    }
  } catch (e) {
    return toActionFailure(e, "Could not load monitoring.") as never
  }
}

export async function createMonitoringEventAction(auditId: string, input: Omit<MonitoringEventInput, "auditId">) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: VERIFY_REQUIRED_ERROR }
    const created = await createMonitoringEvent(supabase as never, user.id, { ...input, auditId })
    return { ok: true as const, id: created.id }
  } catch (e) {
    return toActionFailure(e, "Could not create monitoring event.") as never
  }
}

export async function createMonitoringAlertAction(input: MonitoringAlertInput) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: VERIFY_REQUIRED_ERROR }
    const created = await createMonitoringAlert(supabase as never, user.id, input)
    return { ok: true as const, id: created.id }
  } catch (e) {
    return toActionFailure(e, "Could not create alert.") as never
  }
}

export async function sendMonitoringAlertAction(alertId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: VERIFY_REQUIRED_ERROR }
    const sent = await sendMonitoringAlert(supabase as never, user.id, alertId)
    return { ok: true as const, sent: sent.sent }
  } catch (e) {
    return toActionFailure(e, "Could not send alert.") as never
  }
}
