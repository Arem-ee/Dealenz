"use server"

import { createClient } from "@/lib/supabase/server"

export interface ReferralAttributionView {
  id: string
  code: string
  status: "pending" | "qualified" | "rewarded"
  created_at: string
  referred_user_id: string
}

// Returns the caller's referral code, creating it on first use.
// The code value is generated inside the RPC, never supplied by the client.
export async function getMyReferralCode(): Promise<{ success: boolean; code?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Unauthorized" }
  }

  const { data, error } = await supabase.rpc("ensure_referral_code")
  if (error) return { success: false, error: error.message }
  const row = Array.isArray(data) ? data[0] : data
  const code = (row as { code?: unknown } | null)?.code
  if (typeof code !== "string" || code.length === 0) {
    return { success: false, error: "Could not load referral code" }
  }
  return { success: true, code }
}

// Lists attributions where the caller is the referrer (people they invited).
// Both-party read is enforced by RLS; this query scopes to referrer.
export async function getMyReferrals(): Promise<{ success: boolean; referrals?: ReferralAttributionView[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("referral_attributions")
    .select("id, code, status, created_at, referred_user_id")
    .eq("referrer_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, referrals: (data ?? []) as ReferralAttributionView[] }
}
