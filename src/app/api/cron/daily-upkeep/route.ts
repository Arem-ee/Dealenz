import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cronQuota, isCronAuthorized, logCronDenied } from "@/lib/cron/guard"

// Daily upkeep (single scheduled job): flip lapsed signing invitations
// and roll subscriptions past period end (expiry clawback + fresh grant).
// The legacy single-purpose routes stay callable; the scheduler only
// needs this one path. Same auth contract as sibling crons
// (CRON_SECRET bearer; open in development when unset).

export const dynamic = "force-dynamic"

const BATCH = 200

export async function GET(req: NextRequest) {
  if (!(await cronQuota(req))) return NextResponse.json({ error: "Rate limited" }, { status: 429 })
  if (!isCronAuthorized(req)) {
    await logCronDenied("daily-upkeep")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
            category: "deadline_digests",
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

  try {
    // Quota alerts: members at ≥80% get warned, owners learn of hits.
    // Throttled to one notice per member per 7 days via activity_events —
    // the pass runs daily, the inbox must not.
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const { data: quotas } = await svc
      .from("member_quotas")
      .select("org_id, user_id, cap_credits")
      .limit(50)
    let quotaNotified = 0
    for (const q of ((quotas ?? []) as Array<{ org_id: string; user_id: string; cap_credits: number }>)) {
      try {
        const { data: spent } = await svc
          .from("credit_ledger")
          .select("amount")
          .eq("org_id", q.org_id)
          .eq("user_id", q.user_id)
          .eq("entry_type", "consumption")
          .eq("status", "finalized")
          .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
          .limit(1000)
        const total = ((spent ?? []) as Array<{ amount: number }>).reduce((a, r) => a + Math.abs(r.amount), 0)
        const pct = q.cap_credits > 0 ? Math.round((total / q.cap_credits) * 100) : 0
        if (pct < 80) continue
        const { data: recent } = await svc
          .from("activity_events")
          .select("id")
          .eq("event_type", "quota_alert")
          .eq("user_id", q.user_id)
          .gte("created_at", weekAgo)
          .limit(1)
        if ((recent ?? []).length > 0) continue
        const { createNotification } = await import("@/lib/notifications/store")
        const hit = pct >= 100
        await createNotification(svc, {
          userId: q.user_id,
          type: "status",
          title: hit ? "Pool limit reached" : "Pool limit at 80%",
          body: hit
            ? `You hit your ${q.cap_credits}-credit pool limit — further pool spend is denied until it resets. Solo balance still works.`
            : `You've used ${pct}% of your ${q.cap_credits}-credit pool limit (rolling 30 days).`,
          link: "/team",
          category: "deadline_digests",
        })
        if (hit) {
          const { data: owners } = await svc
            .from("organization_members")
            .select("user_id")
            .eq("org_id", q.org_id)
            .in("role", ["owner", "admin"])
            .limit(5)
          for (const o of ((owners ?? []) as Array<{ user_id: string }>)) {
            try {
              await createNotification(svc, {
                userId: o.user_id,
                type: "status",
                title: "Member hit pool limit",
                body: `A member reached their ${q.cap_credits}-credit pool limit. Raise it in the Team tab or leave it.`,
                link: "/team",
                category: "deadline_digests",
              })
            } catch {
              // One missed owner never blocks the rest.
            }
          }
        }
        await svc.from("activity_events").insert({
          user_id: q.user_id,
          audit_id: null,
          event_type: "quota_alert",
          payload: { org_id: q.org_id, pct },
        })
        quotaNotified += 1
      } catch {
        // One bad quota never blocks the pass.
      }
    }
    result.quotas = { notified: quotaNotified }
  } catch (e) {
    result.quotas = { error: e instanceof Error ? e.message : "Quota pass failed" }
  }

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  return GET(req)
}
