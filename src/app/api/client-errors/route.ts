import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { reportError } from "@/lib/logger"
import { getTrustedClientIp, checkAnonymousRateLimit } from "@/lib/rate-limit-anon"

// Browser error intake for global-error.tsx. Strictly bounded: short
// validated strings only, per-IP quota, redacted server-side. Never accepts
// deal content, documents, or request payloads — message/stack/url only.
const MAX_MESSAGE = 500
const MAX_STACK = 2000
const MAX_URL = 500
const CLIENT_ERROR_LIMIT = 20
const CLIENT_ERROR_WINDOW_SECONDS = 3600

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > max) return null
  return trimmed
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const ip = getTrustedClientIp(await headers())
  const quota = await checkAnonymousRateLimit(supabase, `clienterr:${ip}`, CLIENT_ERROR_LIMIT, CLIENT_ERROR_WINDOW_SECONDS)
  if (!quota.allowed) {
    return NextResponse.json({ received: false }, { status: 429 })
  }

  let body: { message?: unknown; stack?: unknown; url?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ received: false }, { status: 400 })
  }

  const message = cleanString(body.message, MAX_MESSAGE)
  if (!message) {
    return NextResponse.json({ received: false }, { status: 400 })
  }
  const stack = cleanString(body.stack, MAX_STACK)
  const url = cleanString(body.url, MAX_URL)

  await reportError(supabase, {
    phase: "client_error",
    error: message,
    details: { stack, url },
    severity: "error",
  })
  return NextResponse.json({ received: true }, { status: 200 })
}
