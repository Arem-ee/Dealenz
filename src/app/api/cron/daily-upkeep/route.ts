import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Daily upkeep (single scheduled job): flip lapsed signing invitations
// and roll subscriptions past period end (expiry clawback + fresh grant).
// The legacy single-purpose routes stay callable; the scheduler only
// needs this one path. Same auth contract as sibling crons
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
  const result: Record<string, unknown> = { ok: true }

  try {
    const { expireLapsedInvites } = await import("@/lib/signing/expiry")
    result.expiry = await expireLapsedInvites(svc)
  } catch (e) {
    result.expiry = { error: e instanceof Error ? e.message : "Expiry pass failed" }
  }

  try {
    const { rollOverdueSubscriptions } = await import("@/lib/billing/subscriptions")
    result.allowance = await rollOverdueSubscriptions(svc, BATCH)
  } catch (e) {
    result.allowance = { error: e instanceof Error ? e.message : "Allowance pass failed" }
  }

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  return GET(req)
}
