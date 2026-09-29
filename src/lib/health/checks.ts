import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export type HealthStatus = "ok" | "degraded" | "down"
export type CheckState = "ok" | "unknown" | "degraded" | "unavailable"

export interface HealthReport {
  status: HealthStatus
  checks: {
    app: CheckState
    database: CheckState
    ai: CheckState
  }
}

// Spike threshold: AI fallback events in the trailing hour at or above this
// count degrade the AI check. Raw volumes never leave the server.
export const AI_FALLBACK_SPIKE_THRESHOLD = 10

function hourAgoIso(now: number): string {
  return new Date(now - 3600_000).toISOString()
}

function serviceClient(): ReturnType<typeof createServiceClient> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key)
}

export async function checkHealth(now = Date.now()): Promise<HealthReport> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return { status: "down", checks: { app: "ok", database: "unavailable", ai: "unknown" } }
  }

  // Base reachability through the same anon client the app serves traffic
  // with. Anonymous callers hold no row grants, so a denial here is retried
  // once with the service key before calling the database down: reachability
  // and row grants are different failures.
  const supabase = await createClient()
  const base = await supabase
    .from("system_logs")
    .select("id")
    .gte("created_at", hourAgoIso(now))
    .limit(1)
  let database: CheckState = "unavailable"
  if (!base.error) {
    database = "ok"
  } else {
    const svc = serviceClient()
    if (svc) {
      const retry = await svc.from("system_logs").select("id").limit(1)
      if (!retry.error) database = "ok"
    }
  }
  if (database !== "ok") {
    return { status: "down", checks: { app: "ok", database, ai: "unknown" } }
  }

  // AI fallback volume is ops-internal: only the derived status ships.
  let ai: CheckState = "unknown"
  const svc = serviceClient()
  if (svc) {
    const spike = await svc
      .from("system_logs")
      .select("id")
      .eq("phase", "ai_failure")
      .gte("created_at", hourAgoIso(now))
      .limit(AI_FALLBACK_SPIKE_THRESHOLD + 1)
    if (!spike.error) {
      ai = ((spike.data ?? []) as unknown[]).length >= AI_FALLBACK_SPIKE_THRESHOLD ? "degraded" : "ok"
    }
  }

  const status: HealthStatus = ai === "degraded" ? "degraded" : "ok"
  return { status, checks: { app: "ok", database: "ok", ai } }
}
