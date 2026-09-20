"use server"

import { createClient } from "@/lib/supabase/server"

// Outcome-data flywheel input: which counter-words get copied, linked to
// the deal and rule. Telemetry only (auth-gated, never verified-gated,
// never throws): the copy already happened client-side, so a logging
// failure must never surface. ruleKey + audit linkage lets rule copy
// drive future rule improvement without ever storing user content.

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export async function logPushbackCopy(input: {
  auditId?: string | null
  ruleKey: string
}): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !isUUID(user.id)) return { ok: false }
    if (typeof input.ruleKey !== "string" || input.ruleKey.length === 0 || input.ruleKey.length > 120) {
      return { ok: false }
    }
    let auditId: string | null = null
    if (typeof input.auditId === "string" && isUUID(input.auditId)) {
      const { data: audit } = await supabase
        .from("audits")
        .select("id")
        .eq("id", input.auditId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (audit) auditId = input.auditId
    }
    await supabase.from("activity_events").insert({
      user_id: user.id,
      audit_id: auditId,
      event_type: "pushback_copied",
      payload: { ruleKey: input.ruleKey },
      created_at: new Date().toISOString(),
    })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
