"use server"

import { createClient } from "@/lib/supabase/server"
import { emptyContextEnvelope, parseContextEnvelope } from "@/lib/context/schema"
import { envelopeWithValue, parseDealValue } from "@/lib/deals/value"

// Deal value writes: columns are query accelerators, the envelope stays
// the source of truth. Every write sets both through user_confirmed
// fields; inference merges around them without clobbering. History is
// NULL until a human (or a confirmed inference) says otherwise.

export async function updateDealValue(input: { auditId: string; amount: string; currency: string }): Promise<
  { ok: true; minor: number; currency: string } | { ok: false; error: string }
> {
  const parsed = parseDealValue({ amount: input.amount, currency: input.currency })
  if ("error" in parsed) return { ok: false, error: parsed.error }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.auditId)) {
    return { ok: false, error: "Invalid deal." }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (!user.email_confirmed_at) return { ok: false, error: "Verify your email first." }

  const { data: audit } = await supabase
    .from("audits")
    .select("id, context_envelope, context_version")
    .eq("id", input.auditId)
    .eq("user_id", user.id)
    .maybeSingle()
  const row = audit as { id: string; context_envelope: unknown; context_version: number | null } | null
  if (!row) return { ok: false, error: "Deal not found." }
  let envelope: ReturnType<typeof envelopeWithValue>
  try {
    envelope = envelopeWithValue(row.context_envelope, parsed.minor, parsed.currency)
  } catch {
    return { ok: false, error: "We couldn't record that value. Please try again." }
  }
  const { error } = await supabase
    .from("audits")
    .update({
      deal_value_minor: parsed.minor,
      deal_value_currency: parsed.currency,
      context_envelope: JSON.parse(JSON.stringify(envelope)) as never,
      context_version: envelope.version,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("user_id", user.id)
  if (error) {
    if (error.message.includes("deal_value")) {
      return { ok: false, error: "Values need a database update (migration 00100). Please try again after migrating." }
    }
    return { ok: false, error: "We couldn't record that value." }
  }
  try {
    await supabase.from("activity_events").insert({
      user_id: user.id,
      audit_id: row.id,
      event_type: "deal_value_updated",
      payload: { minor: parsed.minor, currency: parsed.currency },
    })
  } catch {
    // Telemetry never fails the write.
  }
  return { ok: true, minor: parsed.minor, currency: parsed.currency }
}
