import { createClient } from "@/lib/supabase/server"

export type RateLimitedAction = "analyzeDeal" | "generateProtectionPackage"

const LIMITS: Record<RateLimitedAction, number> = {
  analyzeDeal: 5,
  generateProtectionPackage: 10,
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

  const result = data as { allowed: boolean; current_count: number } | undefined

  if (!result?.allowed) {
    return {
      allowed: false,
      error: "You've reached today's usage limit. Please try again tomorrow.",
    }
  }

  return { allowed: true }
}
