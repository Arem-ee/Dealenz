import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cronQuota, isCronAuthorized, logCronDenied } from "@/lib/cron/guard"

// Daily expiry pass: pending invitations whose expiry has passed flip to
// 'expired' so queues read honestly. The row-level trigger (00090) already
// blocks signing on lapsed invitations; this pass only updates the visible
// state. Same auth contract as the deadline-reminders cron (CRON_SECRET
// bearer; open in development when unset). Idempotent: only pending rows
// match, and each row flips once.

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  if (!(await cronQuota(req))) return NextResponse.json({ error: "Rate limited" }, { status: 429 })
  if (!isCronAuthorized(req)) {
    await logCronDenied("signing-expiry")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: "Service not configured" }, { status: 500 })

  const svc = createClient(url, key)

  try {
    const { expireLapsedInvites } = await import("@/lib/signing/expiry")
    const { expired, notified } = await expireLapsedInvites(svc)
    return NextResponse.json({ ok: true, expired, notified })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Expiry pass failed" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
