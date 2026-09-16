"use server"

import { createClient } from "@/lib/supabase/server"

export async function getAiConsentStatus(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from("user_ai_consents")
    .select("has_consented_to_ai_analysis")
    .eq("user_id", user.id)
    .maybeSingle()
  return (data as { has_consented_to_ai_analysis?: boolean } | null)?.has_consented_to_ai_analysis === true
}

export async function grantAiConsent(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("user_ai_consents")
    .upsert(
      {
        user_id: user.id,
        has_consented_to_ai_analysis: true,
        consented_at: now,
        updated_at: now,
      },
      { onConflict: "user_id" }
    )
  if (error) return { success: false, error: error.message }
  return { success: true }
}
