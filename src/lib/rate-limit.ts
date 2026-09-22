import { createClient } from "@/lib/supabase/server"

export type RateLimitedAction = "generateProtectionPackage" | "submitLawyerApplication" | "createCheckout" | "consultant_free_turn" | "gmail_send"

const LIMITS: Record<RateLimitedAction, number> = {
  generateProtectionPackage: 10,
  submitLawyerApplication: 3,
  createCheckout: 10,
  consultant_free_turn: 3,
  gmail_send: 20,
}

/** Single source for daily usage limits shown in the UI. Analyses are not
 * rate-limited: they cost ANALYSIS_CREDITS each, so credits are the gate. */
export function rateLimitFor(action: RateLimitedAction): number {
  return LIMITS[action]
}

export async function checkRateLimit(
  action: RateLimitedAction
): Promise<{ allowed: boolean; error?: string }> {
  const supabase = await createClient()
  const limit = LIMITS[action]

  const { data, error } = await supabase.rpc("increment_usage", {
    p_action_type: action,
    p_limit: limit,
  })

  if (error) {
    return { allowed: false, error: "Usage tracking unavailable. Please try again." }
  }

  // PostgREST returns set-returning RPC results as an array of rows; accept
  // both shapes defensively (fail-closed on anything unrecognized).
  const rows = Array.isArray(data) ? data : [data]
  const result = rows[0] as { allowed: boolean; current_count: number } | undefined

  if (!result || result.allowed !== true) {
    return {
      allowed: false,
      error: "You've reached today's usage limit. Please try again tomorrow.",
    }
  }

  return { allowed: true }
}
