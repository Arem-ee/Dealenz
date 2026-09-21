import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { getFallbackSpike } from "@/lib/logger"

export const dynamic = "force-dynamic"

type DependencyStatus = "ok" | "unavailable" | "unknown" | "degraded"

interface HealthBody {
  status: "ok" | "degraded" | "down"
  checks: {
    app: "ok"
    database: DependencyStatus
    ai: DependencyStatus
  }
}

// Required runtime configuration (presence only — values never leak).
const REQUIRED_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const

export async function GET() {
  const supabase = await createClient()

  // Liveness: the process answered. Dependency checks below are cheap,
  // read-only, and never touch AI providers.
  let database: DependencyStatus = "unavailable"
  try {
    // knowledge_items published rows are world-readable: exercises
    // PostgREST + Postgres + RLS without authentication or PII.
    const { error } = await supabase
      .from("knowledge_items")
      .select("id", { head: true, count: "exact" })
      .eq("status", "published")
      .limit(1)
    database = error ? "unavailable" : "ok"
  } catch {
    database = "unavailable"
  }

  // AI degradation: trailing fallback/failure volume from system_logs.
  // Requires the service role (system_logs SELECT is service-only); without
  // it the check honestly reports unknown instead of guessing. Only the
  // derived status is exposed — raw volumes stay ops-internal.
  let ai: DependencyStatus = "unknown"
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceUrl && serviceKey) {
    try {
      const service = createServiceClient(serviceUrl, serviceKey)
      const spike = await getFallbackSpike(service, 60, 10)
      ai = spike.spiking ? "degraded" : "ok"
    } catch {
      ai = "unknown"
    }
  }

  const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k])
  if (missingEnv.length > 0) database = "unavailable"

  const status = database === "unavailable" ? "down" : ai === "degraded" ? "degraded" : "ok"
  const body: HealthBody = { status, checks: { app: "ok", database, ai } }
  return NextResponse.json(body, {
    status: status === "down" ? 503 : 200,
    headers: { "cache-control": "no-store" },
  })
}
