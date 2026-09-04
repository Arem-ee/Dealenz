"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { seedEnvelopeForDealType } from "@/lib/context"

const ALLOWED_DEAL_TYPES = new Set(["freelance", "generic"] as const)

export type DealType = "freelance" | "generic"

function normalizeDealType(input?: string | null): DealType {
  if (input && ALLOWED_DEAL_TYPES.has(input as DealType)) return input as DealType
  return "freelance"
}

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

  redirect(`/audit/${data.id}`)
}
