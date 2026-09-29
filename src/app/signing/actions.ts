"use server"

import { createClient } from "@/lib/supabase/server"
import { toActionFailure } from "@/lib/action-result"

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export async function revokeSignerInvite(
  auditId: string,
  signerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isUUID(auditId) || !isUUID(signerId)) return { ok: false as const, error: "Invalid signer." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const { data: audit } = await supabase
      .from("audits")
      .select("id")
      .eq("id", auditId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!audit) return { ok: false as const, error: "Deal not found." }
    const { data, error } = await supabase.rpc("revoke_signer_invite", { p_signer_id: signerId })
    if (error) return { ok: false as const, error: "Could not revoke that invitation. Please try again." }
    const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
    if (!row?.success) return { ok: false as const, error: row?.message ?? "That invitation can no longer be revoked." }
    return { ok: true as const }
  } catch (e) {
    return toActionFailure(e, "Could not revoke that invitation.") as never
  }
}
