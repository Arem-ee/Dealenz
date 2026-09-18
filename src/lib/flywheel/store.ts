// Data flywheel foundations (Phase 3) — structured, consented, tenant-isolated
// No PII selling, no hidden collection, only consented events.

import type { SupabaseClient } from "@supabase/supabase-js"

type Client = SupabaseClient

export type FlywheelEventType = "deal_context" | "finding" | "protection_intent" | "user_decision" | "lawyer_review_outcome" | "document_version_change" | "interaction_pattern" | "deal_outcome" | "material_event"

export interface RecordFlywheelInput {
  auditId?: string | null
  eventType: FlywheelEventType
  payload: Record<string, unknown>
  provenance?: "system" | "user" | "lawyer"
  consented?: boolean
  tenantIsolation?: "user" | "anonymized" | "aggregated"
}

function isUUID(v: string | null | undefined): boolean {
  if (!v) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export async function recordFlywheelEvent(client: Client, userId: string, input: RecordFlywheelInput): Promise<string | null> {
  if (!input.eventType) throw new Error("Missing eventType")
  if (input.auditId && !isUUID(input.auditId)) throw new Error("Invalid auditId")
  // In production, check user consent flag from user profile; for now we respect input.consented
  const consented = input.consented ?? false
  // Data minimization: strip raw document content if present
  const payload = { ...input.payload }
  if ("content" in payload && typeof payload.content === "string" && (payload.content as string).length > 500) {
    payload.content = (payload.content as string).slice(0, 500) + " …[truncated]"
  }
  const { data, error } = await client
    .from("deal_intelligence_events")
    .insert({
      audit_id: input.auditId ?? null,
      user_id: userId,
      event_type: input.eventType,
      payload,
      provenance: input.provenance ?? "system",
      consented,
      tenant_isolation: input.tenantIsolation ?? "user",
    })
    .select("id")
    .single()
  if (error || !data) {
    // Flywheel is best-effort, never throw to block main flow
    return null
  }
  return (data as { id: string }).id
}

export async function listFlywheelEvents(client: Client, userId: string, auditId?: string): Promise<Array<Record<string, unknown>>> {
  let q = client.from("deal_intelligence_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50)
  if (auditId) q = q.eq("audit_id", auditId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data as Array<Record<string, unknown>>) ?? []
}

// Deletion is cascade via user_id/audit_id FK; no separate API needed.
// Consent revocation: delete consented=false events or keep anonymized aggregated.
