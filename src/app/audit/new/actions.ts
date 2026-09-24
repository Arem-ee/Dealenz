"use server"

import { createClient } from "@/lib/supabase/server"
import { normalizeDealType } from "@/lib/deal-type"

export type DealType = "freelance" | "generic" | "lease" | "purchase_sale" | "employment" | "founder" | "partnership"

export type CreateAuditResult =
  | { ok: true; auditId: string; threadId: string }
  | { ok: false; error: string }

export async function createAudit(dealTypeInput?: string): Promise<CreateAuditResult> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  // Expected failures return as data: anything thrown across the action
  // boundary reaches the browser as an opaque framework error, hiding the
  // real reason (see lib/action-result.ts).
  if (userError || !user) {
    return { ok: false, error: "Unauthorized — please sign in" }
  }

  const dealType = normalizeDealType(dealTypeInput)

  // The user explicitly picked this deal type in the UI, so the context
  // envelope starts with dealType user_confirmed (Phase 5B). Jurisdiction
  // and currency prefill from the business profile when the user set them,
  // so the confirm card stops asking what was already told.
  const { seedEnvelopeWithProfile } = await import("@/lib/standing/profile")
  const seeded = await seedEnvelopeWithProfile(supabase as never, user.id, dealType)

  const payload: Record<string, unknown> = {
    user_id: user.id,
    title: "New Deal",
    status: "draft",
    deal_type: dealType,
    context_envelope: JSON.parse(JSON.stringify(seeded)) as never,
    context_version: seeded.version,
  }

  let data: { id: string } | null = null
  let error: { message: string } | null = null
  const result = await supabase.from("audits").insert(payload).select("id").single()
  data = result.data as { id: string } | null
  error = result.error as { message: string } | null

  if (error && (error.message.includes("deal_type") || error.message.includes("context_envelope") || error.message.includes("context_version"))) {
    // Database predates the deal_type and/or context columns: retry with only
    // universally available fields. The context envelope is lazily seeded on
    // first context interaction (ensureContextEnvelope).
    const fallbackPayload: Record<string, unknown> = {
      user_id: user.id,
      title: "New Deal",
      status: "draft",
    }
    const retry = await supabase.from("audits").insert(fallbackPayload).select("id").single()
    data = retry.data as { id: string } | null
    error = retry.error as { message: string } | null
  }

  if (error || !data) {
    return { ok: false, error: "We couldn't create your deal. Please try again." }
  }

  // Chat-first: a new deal opens as a thread, not the old workspace view.
  // Returns ids instead of redirecting so the caller can attach a staged
  // file to the new audit before navigating.
  const { createConversation } = await import("@/lib/conversation/store")
  const conv = await createConversation(supabase as never, user.id, {
    firstText: "New Deal",
    attachedAuditId: data.id,
  }).catch(() => null)
  if (!conv) {
    return { ok: false, error: "Deal created, but we couldn't open its chat. Please try again from Home." }
  }
  try {
    await supabase.from("activity_events").insert({
      user_id: user.id,
      audit_id: data.id,
      event_type: "deal_created",
      payload: { dealType },
      created_at: new Date().toISOString(),
    })
  } catch {
    // Activity is telemetry: never fail creation for it.
  }
  return { ok: true, auditId: data.id, threadId: conv.id }
}
