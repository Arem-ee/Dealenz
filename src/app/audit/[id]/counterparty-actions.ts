"use server"

import { createClient } from "@/lib/supabase/server"
import { toActionFailure } from "@/lib/action-result"
import { assembleCounterpartyMemory, type CounterpartyMemory } from "@/lib/counterparty/memory"

// Counterparty memory wiring: explicit client linkage (created here) plus
// history reads over the user's own prior linked deals. Identity is never
// guessed from text; unlinked deals report no identity.

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export async function linkCounterpartyClient(
  auditId: string,
  input: { name: string; company?: string; email?: string }
): Promise<{ ok: true; clientId: string } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !isUUID(user.id)) return { ok: false as const, error: "You must be signed in." }
    if (!isUUID(auditId)) return { ok: false as const, error: "Invalid deal." }

    const name = typeof input.name === "string" ? input.name.trim() : ""
    if (name.length < 1 || name.length > 120) return { ok: false as const, error: "Enter a counterparty name." }
    const company = typeof input.company === "string" && input.company.trim() ? input.company.trim().slice(0, 120) : null
    const email = typeof input.email === "string" && input.email.trim() ? input.email.trim().slice(0, 254) : null
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false as const, error: "Enter a valid email or leave it blank." }

    const { data: audit } = await supabase
      .from("audits")
      .select("id")
      .eq("id", auditId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!audit) return { ok: false as const, error: "Deal not found." }

    // Reuse an existing profile with the same name (case-insensitive) so
    // history accumulates instead of fragmenting across duplicates.
    const { data: profiles } = await supabase
      .from("client_profiles")
      .select("id, name")
      .eq("user_id", user.id)
      .limit(100)
    const existing = ((profiles ?? []) as Array<{ id: string; name: string }>).find(
      (p) => p.name.trim().toLowerCase() === name.toLowerCase()
    )
    let clientId = existing?.id as string | undefined
    if (!clientId) {
      const { data: created, error: createError } = await supabase
        .from("client_profiles")
        .insert({ user_id: user.id, name, company, email })
        .select("id")
        .single()
      if (createError || !created) return { ok: false as const, error: "Could not save the counterparty." }
      clientId = (created as { id: string }).id
    }

    const { error: linkError } = await supabase
      .from("audits")
      .update({ client_id: clientId, updated_at: new Date().toISOString() })
      .eq("id", auditId)
      .eq("user_id", user.id)
    if (linkError) return { ok: false as const, error: "Could not link the counterparty." }
    return { ok: true as const, clientId }
  } catch (e) {
    return toActionFailure(e, "Could not link the counterparty.") as never
  }
}

export async function getCounterpartyMemory(
  auditId: string
): Promise<{ ok: true; memory: CounterpartyMemory } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !isUUID(user.id)) return { ok: false as const, error: "You must be signed in." }
    if (!isUUID(auditId)) return { ok: false as const, error: "Invalid deal." }

    const { data: audit } = await supabase
      .from("audits")
      .select("id, client_id")
      .eq("id", auditId)
      .eq("user_id", user.id)
      .maybeSingle() as { data: { id: string; client_id: string | null } | null }
    if (!audit) return { ok: false as const, error: "Deal not found." }
    if (!audit.client_id) {
      return { ok: true as const, memory: assembleCounterpartyMemory(auditId, null, []) }
    }

    const { data: client } = await supabase
      .from("client_profiles")
      .select("name")
      .eq("id", audit.client_id)
      .eq("user_id", user.id)
      .maybeSingle() as { data: { name: string } | null }
    const clientName = client?.name ?? null

    const { data: priors } = await supabase
      .from("audits")
      .select("id, title, deal_type, status, created_at, structured_data")
      .eq("user_id", user.id)
      .eq("client_id", audit.client_id)
      .neq("id", auditId)
      .order("created_at", { ascending: false })
      .limit(6)

    return {
      ok: true as const,
      memory: assembleCounterpartyMemory(auditId, clientName, ((priors ?? []) as never[]).slice(0, 5)),
    }
  } catch (e) {
    return toActionFailure(e, "Could not load counterparty history.") as never
  }
}
