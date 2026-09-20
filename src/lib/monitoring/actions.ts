"use server"

import { createClient } from "@/lib/supabase/server"
import { toActionFailure } from "@/lib/action-result"
import {
  createMonitoringAlert,
  createMonitoringEvent,
  listMonitoringEvents,
  sendMonitoringAlert,
} from "./store"
import { extractMonitoringEvents } from "./extract"
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

// Notice-deadline extraction at signing (P2 loop-closer): when the owner
// views an executed deal, pull dated obligations out of the SIGNED text
// (final version, falling back to latest) plus material findings, and turn
// them into monitoring events. Runs once per executed version, guarded by
// a server-written structured_data flag (sanitized from client writes).
// Best-effort by design: extraction must never break the document view.
export async function ensureSigningMonitoring(auditId: string): Promise<
  | { ok: true; created: number; total: number; versionId: string }
  | { ok: true; skipped: true }
  | { ok: false; error: string }
> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: true as const, skipped: true as const }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(auditId)) {
      return { ok: false as const, error: "Invalid audit ID" }
    }

    const { data: audit } = await supabase
      .from("audits")
      .select("structured_data, raw_input")
      .eq("id", auditId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!audit) return { ok: false as const, error: "Deal not found." }
    const structured = ((audit as { structured_data?: Record<string, unknown> } | null)?.structured_data ?? {}) as Record<string, unknown>

    const { data: versionRows } = await supabase
      .from("document_versions")
      .select("id, content")
      .eq("audit_id", auditId)
      .order("version_number", { ascending: false })
      .limit(10)
    const versions = ((versionRows ?? []) as Array<{ id: string; content: string | null }>).map((v) => ({
      id: String(v.id),
      content: String(v.content ?? ""),
    }))
    if (versions.length === 0) return { ok: true as const, skipped: true as const }

    const { data: finals } = await supabase.from("final_documents").select("document_version_id").eq("audit_id", auditId).limit(10)
    const finalIds = new Set(((finals ?? []) as Array<{ document_version_id: string }>).map((f) => String(f.document_version_id)))
    const target = versions.find((v) => finalIds.has(v.id)) ?? versions[0]

    const flag = structured.monitoringExtracted as { versionId?: string } | undefined
    if (flag?.versionId === target.id) {
      const existing = await listMonitoringEvents(supabase as never, user.id, auditId).catch(() => [])
      const total = existing.filter((e) => e.source === "extracted" && String(e.document_version_id ?? "") === target.id).length
      return { ok: true as const, created: 0, total, versionId: target.id }
    }

    const detFindings = (structured.deterministicFindings as Array<{
      status?: string
      ruleKey?: string
      finding?: { severity?: string; summary?: string; evidence?: Array<{ quote?: string | null; location?: unknown }> }
    }> | undefined) ?? []
    const findings = detFindings
      .filter((r) => r.status === "FAIL" && r.finding && typeof r.finding.summary === "string")
      .map((r) => ({
        ruleKey: String(r.ruleKey ?? r.finding?.summary ?? "unknown"),
        severity: String(r.finding?.severity ?? "attention"),
        summary: String(r.finding?.summary ?? ""),
        evidence: (r.finding?.evidence ?? []).map((e) => ({ quote: e.quote ?? null, location: e.location })),
      }))

    const extracted = extractMonitoringEvents({
      rawInput: target.content,
      auditId,
      documentVersionId: target.id,
      findings,
    })

    const existing = await listMonitoringEvents(supabase as never, user.id, auditId).catch(() => [])
    const seenTitles = new Set(
      existing
        .filter((e) => e.source === "extracted" && String(e.document_version_id ?? "") === target.id)
        .map((e) => String(e.title ?? ""))
    )
    const fresh = extracted.filter((e) => !seenTitles.has(e.title))
    let created = 0
    for (const event of fresh) {
      try {
        await createMonitoringEvent(supabase as never, user.id, event)
        created += 1
      } catch {
        // One bad event must not block the rest; the flag below still
        // records the run so a reload retries only via a new version.
      }
    }

    const merged = {
      ...structured,
      monitoringExtracted: {
        versionId: target.id,
        extractedAt: new Date().toISOString(),
        created,
      },
    }
    await supabase.from("audits").update({ structured_data: merged, updated_at: new Date().toISOString() }).eq("id", auditId).eq("user_id", user.id)

    const total = seenTitles.size + created
    return { ok: true as const, created, total, versionId: target.id }
  } catch (e) {
    return toActionFailure(e, "Could not extract monitoring deadlines.") as never
  }
}
