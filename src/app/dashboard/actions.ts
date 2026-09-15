"use server"

import { createClient } from "@/lib/supabase/server"
import { rateLimitFor } from "@/lib/rate-limit"

export async function searchDeals(query: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Unauthorized" }
  }

  if (!query.trim()) {
    return { success: true, results: [] }
  }

  const { data, error } = await supabase
    .from("audits")
    .select("id, title, status, updated_at")
    .eq("user_id", user.id)
    .ilike("title", `%${query.trim()}%`)
    .order("updated_at", { ascending: false })
    .limit(8)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, results: data ?? [] }
}

export async function getRecentNotifications() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("activity_events")
    .select("id, event_type, audit_id, payload, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, events: data ?? [] }
}

export async function getCreditBalanceForHome(): Promise<number | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  try {
    const { data } = await supabase.rpc("credit_balance" as never)
    if (Array.isArray(data)) return typeof (data as unknown as { balance?: number }[])[0]?.balance === "number" ? (data as unknown as { balance: number }[])[0].balance : null
    if (data && typeof data === "object" && "balance" in (data as Record<string, unknown>)) return (data as Record<string, unknown>).balance as number
    if (typeof data === "number") return data
    return null
  } catch {
    return null
  }
}

export async function getUsageStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const today = new Date().toISOString().split("T")[0]

  const { data } = await supabase
    .from("usage_tracking")
    .select("action_type, count")
    .eq("user_id", user.id)
    .eq("date", today)

  const stats = {
    analyzeDeal: 0,
    generateProtectionPackage: 0,
    analyzeLimit: rateLimitFor("analyzeDeal"),
    generationLimit: rateLimitFor("generateProtectionPackage"),
  }
  if (data) {
    for (const row of data) {
      if (row.action_type === "analyzeDeal") stats.analyzeDeal = row.count
      if (row.action_type === "generateProtectionPackage") stats.generateProtectionPackage = row.count
    }
  }

  return stats
}
