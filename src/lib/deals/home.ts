"use server"

import { createClient } from "@/lib/supabase/server"
import { applyUserConfirmation } from "@/lib/context/confirm"
import { normalizeDealType } from "@/lib/deal-type"

function titleFromText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim().slice(0, 70)
  if (!normalized) return "New Deal"
  const cut = normalized.slice(0, 60).replace(/\s+\S*$/, "").replace(/[,;:.!?]+$/, "").trim()
  return cut || normalized.slice(0, 60)
}

export async function createHomeDeal(text: string, jurisdiction?: string, dealTypeHint?: string, value?: { amount: string; currency: string }): Promise<{ id: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("You must be signed in.")
  if (!user.email_confirmed_at) throw new Error("Please verify your email.")
  const trimmed = text.trim().slice(0, 8000)
  if (!trimmed) throw new Error("Tell Dealenz what you are working on.")
  const hint = dealTypeHint ?? "generic"
  const dealType = normalizeDealType(hint)
  const chosen = (jurisdiction ?? "").trim()
  // Profile prefill first (jurisdiction from country, currency from default):
  // an explicit choice below still wins because user_confirmed overwrites.
  const { seedEnvelopeWithProfile } = await import("@/lib/standing/profile")
  const profileSeeded = await seedEnvelopeWithProfile(supabase as never, user.id, dealType)
  const seeded = chosen
    ? applyUserConfirmation(profileSeeded, { jurisdiction: { value: chosen, confidence: 1 } })
    : profileSeeded
  let valueMinor: number | null = null
  let valueCurrency: string | null = null
  let withValue = seeded
  if (value && (value.amount.trim() !== "" || value.currency.trim() !== "")) {
    const { parseDealValue } = await import("@/lib/deals/value")
    const parsed = parseDealValue({ amount: value.amount, currency: value.currency })
    if ("error" in parsed) throw new Error(parsed.error)
    const { envelopeWithValue } = await import("@/lib/deals/value")
    withValue = envelopeWithValue(seeded, parsed.minor, parsed.currency)
    valueMinor = parsed.minor
    valueCurrency = parsed.currency
  }
  const payload: Record<string, unknown> = {
    user_id: user.id,
    title: titleFromText(trimmed),
    status: "draft",
    deal_type: dealType,
    context_envelope: JSON.parse(JSON.stringify(withValue)) as never,
    context_version: withValue.version,
    raw_input: trimmed,
    source_type: "paste",
    ...(valueMinor !== null ? { deal_value_minor: valueMinor, deal_value_currency: valueCurrency } : {}),
  }
  let data: { id: string } | null = null
  let error: { message: string } | null = null
  const result = await supabase.from("audits").insert(payload).select("id").single()
  data = result.data as { id: string } | null
  error = result.error as { message: string } | null
  if (error && (error.message.includes("deal_type") || error.message.includes("context_envelope") || error.message.includes("context_version") || error.message.includes("raw_input") || error.message.includes("deal_value"))) {
    const fallback: Record<string, unknown> = {
      user_id: user.id,
      title: titleFromText(trimmed),
      status: "draft",
    }
    const retry = await supabase.from("audits").insert(fallback).select("id").single()
    data = retry.data as { id: string } | null
    error = retry.error as { message: string } | null
    if (data) {
      await supabase.from("audits").update({ raw_input: trimmed }).eq("id", data.id).eq("user_id", user.id)
    }
  }
  if (error || !data) throw new Error("We couldn't start your deal. Please try again.")
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
  return { id: data.id }
}
