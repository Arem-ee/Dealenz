"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { seedEnvelopeForDealType } from "@/lib/context"
import { normalizeDealType } from "@/lib/deal-type"

export type DealType = "freelance" | "generic" | "lease" | "purchase_sale" | "employment" | "founder" | "partnership"

export async function createAudit(template?: string, dealTypeInput?: string) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("Unauthorized – please sign in")
  }

  const dealType = normalizeDealType(dealTypeInput)

  // The user explicitly picked this deal type in the UI, so the context
  // envelope starts with dealType user_confirmed (Phase 5B).
  const seeded = seedEnvelopeForDealType(dealType)

  const payload: Record<string, unknown> = {
    user_id: user.id,
    title: "New Deal",
    status: "draft",
    deal_type: dealType,
    context_envelope: JSON.parse(JSON.stringify(seeded)) as never,
    context_version: seeded.version,
  }

  if (template) {
    payload.source_type = template
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
    if (template) fallbackPayload.source_type = template
    const retry = await supabase.from("audits").insert(fallbackPayload).select("id").single()
    data = retry.data as { id: string } | null
    error = retry.error as { message: string } | null
  }

  if (error || !data) {
    throw new Error(`Failed to create audit: ${error?.message ?? "unknown error"}`)
  }

  // Chat-first: a new deal opens as a thread, not the old workspace view.
  const { createConversation } = await import("@/lib/conversation/store")
  const conv = await createConversation(supabase as never, user.id, {
    firstText: "New Deal",
    attachedAuditId: data.id,
  }).catch(() => null)
  if (!conv) {
    throw new Error("Deal created, but we couldn't open its chat. Please try again from Home.")
  }
  redirect(`/chat/${conv.id}`)
}
