import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Allowance rollover pass: subscriptions past period end get the unspent
// slice of the closing grant clawed back (packs untouched), the new
// period granted, and the window advanced. Idempotent per period via
// ledger idempotency keys. Same auth contract as sibling crons
// (CRON_SECRET bearer; open in development when unset).

export const dynamic = "force-dynamic"

const BATCH = 200

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  if (!cronSecret) return process.env.NODE_ENV !== "production"
  return auth === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
