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

  try {
    const { rollOverdueOrgSubscriptions, checkPoolThresholds } = await import("@/lib/billing/org-subscriptions")
    const rolled = await rollOverdueOrgSubscriptions(svc, BATCH)
    const thresholds = await checkPoolThresholds(svc, BATCH)
    result.orgAllowance = { ...rolled, thresholdAlerts: thresholds.notified }
  } catch (e) {
    result.orgAllowance = { error: e instanceof Error ? e.message : "Org allowance pass failed" }
  }

  try {
    // Share hygiene: revoke lapsed shares (enforcement is lazy in RLS),
    // notifying owners best-effort. Readers simply lose access.
    const { data: lapsed } = await svc
      .from("deal_shares")
      .select("deal_id")
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString())
      .limit(BATCH)
    const lapsedIds = ((lapsed ?? []) as Array<{ deal_id: string }>).map((r) => r.deal_id)
    const { data: flipped, error } = await svc.rpc("expire_deal_shares")
    if (error) throw new Error(error.message)
    let shareNotified = 0
    if (lapsedIds.length > 0) {
      const { data: audits } = await svc
        .from("audits")
        .select("id, user_id, title")
        .in("id", [...new Set(lapsedIds)].slice(0, BATCH))
      const { createNotification } = await import("@/lib/notifications/store")
      for (const a of ((audits ?? []) as Array<{ id: string; user_id: string; title: string | null }>)) {
        try {
          await createNotification(svc, {
            userId: a.user_id,
            type: "status",
            title: "Deal share expired",
            body: `Sharing lapsed on “${a.title?.trim() ? a.title : "Untitled"}” — re-share from the thread to restore access.`,
            link: "/dashboard",
          })
          shareNotified += 1
        } catch {
          // One missed owner never blocks the rest.
        }
      }
    }
    result.shares = { expired: typeof flipped === "number" ? flipped : 0, notified: shareNotified }
  } catch (e) {
    result.shares = { error: e instanceof Error ? e.message : "Share pass failed" }
  }

  try {
    // Coverage hygiene: lapsed delegations flip inactive. Enforcement is
    // lazy (decide-time + RLS time predicates), so this only tidies reads.
    const { data, error } = await svc.rpc("expire_approval_delegations")
    if (error) throw new Error(error.message)
    result.coverage = { expired: typeof data === "number" ? data : 0 }
  } catch (e) {
    result.coverage = { error: e instanceof Error ? e.message : "Coverage pass failed" }
  }

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  return GET(req)
}
