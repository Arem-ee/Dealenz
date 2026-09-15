"use server"

import { createClient } from "@/lib/supabase/server"
import { classifyOperation, isGreeting } from "@/lib/conversation/classify"
import { priceForOperation } from "@/lib/credits/pricing"
import { rateLimitFor } from "@/lib/rate-limit"

export async function estimateConsultationCredits(text: string): Promise<number> {
  if (!text || !text.trim()) return 0
  if (isGreeting(text)) return 0
  try {
    return priceForOperation(classifyOperation(text, false))
  } catch {
    return 1
  }
}

export interface ConsultantEntryPricing {
  cost: number
  freeTurnsRemaining: number
  freeTurnsLimit: number
  isFree: boolean
}

export async function getConsultantEntryPricing(text: string): Promise<ConsultantEntryPricing> {
  const cost = await estimateConsultationCredits(text)
  const freeTurnsLimit = rateLimitFor("consultant_free_turn")
  let used = 0
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const today = new Date().toISOString().split("T")[0]
      const { data } = await supabase
        .from("usage_tracking")
        .select("count")
        .eq("user_id", user.id)
        .eq("action_type", "consultant_free_turn")
        .eq("date", today)
        .maybeSingle()
      if (data) used = (data as { count: number }).count ?? 0
    }
  } catch {
    used = 0
  }
  const freeTurnsRemaining = Math.max(0, freeTurnsLimit - used)
  return { cost, freeTurnsRemaining, freeTurnsLimit, isFree: cost === 0 || freeTurnsRemaining > 0 }
}