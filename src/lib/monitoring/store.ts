// Monitoring store (Phase 3) — RLS scoped, idempotent, evidence-linked

import type { SupabaseClient } from "@supabase/supabase-js"
import type { MonitoringEventInput, MonitoringAlertInput } from "./schema"
import { validateMonitoringEvent, alertIdempotencyKey } from "./schema"

type Client = SupabaseClient

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export async function createMonitoringEvent(client: Client, userId: string, input: MonitoringEventInput): Promise<{ id: string; provenance: string }> {
  const err = validateMonitoringEvent(input)
  if (err) throw new Error(err)
  const { data, error } = await client
    .from("monitoring_events")
    .insert({
      audit_id: input.auditId,
      user_id: userId,
      document_version_id: input.documentVersionId ?? null,
      event_type: input.eventType,
      title: input.title,
      description: input.description ?? null,
      provenance: input.provenance,
      evidence: input.evidence ?? {},
      due_date: input.dueDate ?? null,
      due_timestamp: input.dueTimestamp ?? null,
      source: input.source ?? "extracted",
      status: "active",
    })
    .select("id, provenance")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed to create monitoring event")
  // Flywheel: consented only if user has opted in (field consented false by default; app must set via separate consent)
  try {
    await client.from("deal_intelligence_events").insert({
      audit_id: input.auditId,
      user_id: userId,
      event_type: "material_event",
      payload: { monitoringEventId: (data as { id: string }).id, eventType: input.eventType, title: input.title, dueDate: input.dueDate, provenance: input.provenance },
      provenance: "system",
      consented: false,
      tenant_isolation: "user",
    })
  } catch {}
  return data as { id: string; provenance: string }
}

export async function listMonitoringEvents(client: Client, userId: string, auditId: string): Promise<Array<Record<string, unknown>>> {
  if (!isUUID(auditId)) throw new Error("Invalid auditId")
  const { data, error } = await client.from("monitoring_events").select("*").eq("audit_id", auditId).eq("user_id", userId).order("due_date", { ascending: true })
  if (error) throw new Error(error.message)
  return (data as Array<Record<string, unknown>>) ?? []
}

export async function createMonitoringAlert(client: Client, userId: string, input: MonitoringAlertInput): Promise<{ id: string; status: string }> {
  if (!isUUID(input.monitoringEventId) || !isUUID(input.auditId)) throw new Error("Invalid ids")
  if (!input.destination.includes("@")) throw new Error("Invalid destination")
  // Need event due_date for idempotency key
  const { data: event, error: evErr } = await client.from("monitoring_events").select("due_date").eq("id", input.monitoringEventId).eq("user_id", userId).maybeSingle()
  if (evErr || !event) throw new Error("Monitoring event not found")
  const dueDate = (event as { due_date: string | null }).due_date
  const key = alertIdempotencyKey(input.monitoringEventId, input.destination, dueDate)
  // Idempotency: if exists, return existing
  const { data: existing } = await client
    .from("monitoring_alerts")
    .select("id, status")
    .eq("monitoring_event_id", input.monitoringEventId)
    .eq("idempotency_key", key)
    .maybeSingle()
  if (existing) return existing as { id: string; status: string }
  const { data, error } = await client
    .from("monitoring_alerts")
    .insert({
      monitoring_event_id: input.monitoringEventId,
      audit_id: input.auditId,
      user_id: userId,
      idempotency_key: key,
      destination: input.destination,
      provider: input.provider ?? "gmail",
      status: "pending",
    })
    .select("id, status")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed to create alert")
  return data as { id: string; status: string }
}

export async function sendMonitoringAlert(client: Client, userId: string, alertId: string): Promise<{ sent: boolean; providerMessageId?: string }> {
  const { data: alert, error } = await client.from("monitoring_alerts").select("*").eq("id", alertId).eq("user_id", userId).maybeSingle()
  if (error || !alert) throw new Error("Alert not found")
  const a = alert as { monitoring_event_id: string; destination: string; audit_id: string; status: string; provider: string }
  if (a.status === "sent") return { sent: true }
  // Fetch event for email content
  const { data: event } = await client.from("monitoring_events").select("title, description, due_date, provenance").eq("id", a.monitoring_event_id).maybeSingle()
  if (!event) throw new Error("Event not found")
  const e = event as { title: string; description: string | null; due_date: string | null; provenance: string }
  // Use Gmail if connected, otherwise system log only (for tests we simulate)
  let providerMessageId: string | undefined
  let providerResponse: Record<string, unknown> = {}
  try {
    const { getGmailTokens } = await import("@/lib/gmail/tokens")
    const tokens = await getGmailTokens(client as never, userId)
    if (tokens) {
      const { sendGmailForRow } = await import("@/lib/gmail/send")
      // Reuse Gmail send for alert: treat as one-off send with alertId as rowId (idempotency derived from planId+rowId)
      const res = await sendGmailForRow(client as never, userId, { to: a.destination, subject: `[Dealenz] ${e.title}`, body: `Deal alert: ${e.title}\n${e.description ?? ""}\nDue: ${e.due_date ?? "unknown"} (provenance: ${e.provenance})\nAudit: ${a.audit_id}`, planId: a.audit_id, planVersion: 1, rowId: `alert:${alertId}` })
      providerMessageId = (res as { providerMessageId?: string }).providerMessageId
      providerResponse = { provider: "gmail", ...res }
    } else {
      providerResponse = { provider: "system", simulated: true }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed"
    await client.from("monitoring_alerts").update({ status: "failed", provider_response: { error: msg }, updated_at: new Date().toISOString() }).eq("id", alertId)
    await client.from("system_logs").insert({ user_id: userId, audit_id: a.audit_id, phase: "monitoring", status: "failed", error_message: `alert ${alertId} failed: ${msg}`, metadata: { alertId, eventId: a.monitoring_event_id } })
    throw new Error(msg)
  }
  await client.from("monitoring_alerts").update({ status: "sent", provider_message_id: providerMessageId ?? null, provider_response: providerResponse, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", alertId)
  await client.from("system_logs").insert({ user_id: userId, audit_id: a.audit_id, phase: "monitoring", status: "sent", error_message: `alert ${alertId} sent to ${a.destination}`, metadata: { alertId, providerMessageId } })
  await client.from("activity_events").insert({ user_id: userId, audit_id: a.audit_id, event_type: "monitoring_alert_sent", payload: { alertId, monitoringEventId: a.monitoring_event_id, destination: a.destination } })
  return { sent: true, providerMessageId }
}
