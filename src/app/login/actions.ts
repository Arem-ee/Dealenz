"use server"

import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { logEvent } from "@/lib/logger"
import { getTrustedClientIp, checkAnonymousRateLimit } from "@/lib/rate-limit-anon"

// Unauthenticated observability with abuse bounds: fixed phase allowlist,
// truncated messages, durable per-IP rate limiting. Logging must never
// become an unbounded write path or a sensitive-data sink.
const AUTH_FAILURE_MODES = ["login", "register"] as const
const MAX_AUTH_ERROR_CHARS = 500
const AUTH_LOG_LIMIT = 20
const AUTH_LOG_WINDOW_SECONDS = 3600

export async function logAuthFailure(errorMessage: string, mode: "login" | "register") {
  if (!AUTH_FAILURE_MODES.includes(mode)) return
  if (typeof errorMessage !== "string" || errorMessage.trim().length === 0) return

  const supabase = await createClient()
  const ip = getTrustedClientIp(await headers())
  const quota = await checkAnonymousRateLimit(supabase, `authlog:${ip}`, AUTH_LOG_LIMIT, AUTH_LOG_WINDOW_SECONDS)
  if (!quota.allowed) return

  await logEvent({
    phase: `auth_${mode}`,
    status: "failure",
    error_message: errorMessage.slice(0, MAX_AUTH_ERROR_CHARS),
  })
}

export async function resendVerification() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "No authenticated user" }
  }

  // Daily cap: verification emails cost provider sends; 5/day is generous
  // for a legitimate user and stops automated re-send abuse.
  const { checkRateLimit } = await import("@/lib/rate-limit")
  const rate = await checkRateLimit("verification_resend")
  if (!rate.allowed) {
    return { success: false, error: rate.error ?? "Too many resends. Please try again tomorrow." }
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email!,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
