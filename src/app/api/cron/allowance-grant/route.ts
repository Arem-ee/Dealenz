import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cronQuota, isCronAuthorized, logCronDenied } from "@/lib/cron/guard"

// Allowance rollover pass: subscriptions past period end get the unspent
// slice of the closing grant clawed back (packs untouched), the new
// period granted, and the window advanced. Idempotent per period via
// ledger idempotency keys. Same auth contract as sibling crons
// (CRON_SECRET bearer; fail-closed unless explicit local opt-in).

export const dynamic = "force-dynamic"

const BATCH = 200

export async function GET(req: NextRequest) {
  if (!(await cronQuota(req))) return NextResponse.json({ error: "Rate limited" }, { status: 429 })
  if (!isCronAuthorized(req)) {
    await logCronDenied("allowance-grant")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: "Service not configured" }, { status: 500 })

  const svc = createClient(url, key)

  try {
    const { rollOverdueSubscriptions } = await import("@/lib/billing/subscriptions")
    const { rolled, failed } = await rollOverdueSubscriptions(svc, BATCH)
    return NextResponse.json({ ok: true, rolled, failed })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Rollover failed" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
