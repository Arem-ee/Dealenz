import type { SupabaseClient } from "@supabase/supabase-js"

// Billing scope resolution: solo (null) or one org pool. The scope row is
// the user's explicit switch (Settings/TopBar); membership is re-verified
// here so a removed member falls back to solo instead of failing closed
// into someone else's pool. Callers pass the result into reserve/balance;
// finalize/void/consume derive scope from the reservation row itself.

export async function resolveSpendScope(
  client: SupabaseClient,
  userId: string
): Promise<string | null> {
  try {
    const { data: scope } = await client
      .from("user_billing_scope")
      .select("org_id")
      .eq("user_id", userId)
      .maybeSingle()
    const orgId = (scope as { org_id?: string | null } | null)?.org_id ?? null
    if (!orgId) return null
    const { data: membership } = await client
      .from("organization_members")
      .select("org_id")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle()
    if (!membership) return null
    return orgId
  } catch {
    return null
  }
}

export async function setSpendScope(
  client: SupabaseClient,
  userId: string,
  orgId: string | null
): Promise<void> {
  if (orgId !== null) {
    const { data: membership } = await client
      .from("organization_members")
      .select("org_id")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle()
    if (!membership) throw new Error("You are not a member of that organization.")
  }
  const { error } = await client
    .from("user_billing_scope")
    .upsert({ user_id: userId, org_id: orgId, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
  if (error) throw new Error(error.message)
}
