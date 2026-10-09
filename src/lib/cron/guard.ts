import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkAnonymousRateLimit, getTrustedClientIp } from "@/lib/rate-limit-anon"

export function cronService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export function isCronAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  if (!cronSecret) {
    return process.env.NODE_ENV !== "production" && process.env.ALLOW_UNAUTH_CRON === "1"
  }
  return auth === `Bearer ${cronSecret}`
}

export async function cronQuota(req: NextRequest): Promise<boolean> {
  try {
    const svc = cronService()
    if (!svc) return false
    const ip = getTrustedClientIp(req.headers)
    const quota = await checkAnonymousRateLimit(
      svc as unknown as Parameters<typeof checkAnonymousRateLimit>[0],
      `cron:${ip}`,
      120,
      3600
    )
    return quota.allowed
  } catch {
    return false
  }
}

export async function logCronDenied(route: string): Promise<void> {
  try {
    const svc = cronService()
    if (!svc) return
    await svc.from("system_logs").insert({
      phase: "cron_unauthorized",
      status: "failure",
      error_message: `Unauthorized cron attempt on ${route}`,
    })
  } catch {
    // Best-effort.
  }
}
