"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { isAdminSessionUser } from "@/lib/auth/admin"

export interface ActivationStats {
  users: number
  usersLast30d: number
  analyzedUsers: number
  secondAnalysisUsers: number
  askThreads: number
  purchasesSucceeded: number
  revenueMinorByCurrency: Record<string, number>
  referralsByStatus: Record<string, number>
  medianSignupToFirstAnalysisHrs: number | null
  windowDays: number
  truncated: boolean
}

const WINDOW_DAYS = 30
const ROW_LIMIT = 2000

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminSessionUser(user)) throw new Error("Admin only")
  return user
}

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Service unavailable")
  return createServiceClient(url, key)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * Founder funnel from first-party tables only (no analytics vendor):
 * signup → first analysis → second analysis (the loop), plus ask threads,
 * purchases, and referral states. Counts only — no content, no PII beyond
 * aggregate math. Bounded reads (ROW_LIMIT each) with a truncated flag when
 * a table hits the cap, so big months read as "at least", never silently exact.
 */
export async function getActivationStats(): Promise<{ ok: true; stats: ActivationStats } | { ok: false; error: string }> {
  try {
    await requireAdmin()
    const svc = service()
    const since = new Date(Date.now() - WINDOW_DAYS * 86400_000)

    // Signups via the auth admin API (paginated, bounded).
    let users: Array<{ id: string; created_at: string }> = []
    let page = 1
    let truncated = false
    for (;;) {
      const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 })
      if (error || !data) break
      users = users.concat(data.users.map((u) => ({ id: u.id, created_at: u.created_at })))
      if (data.users.length < 200 || page >= 10) {
        if (page >= 10 && data.users.length === 200) truncated = true
        break
      }
      page += 1
    }
    const createdAtByUser = new Map(users.map((u) => [u.id, new Date(u.created_at).getTime()]))

    const { data: audits } = await svc
      .from("audits")
      .select("user_id, status, created_at")
      .order("created_at", { ascending: true })
      .limit(ROW_LIMIT)
    const auditRows = ((audits ?? []) as Array<{ user_id: string; status: string; created_at: string }>)
    if (auditRows.length >= ROW_LIMIT) truncated = true
    const analyzedByUser = new Map<string, number[]>()
    for (const a of auditRows) {
      if (a.status !== "analyzed") continue
      const list = analyzedByUser.get(a.user_id) ?? []
      list.push(new Date(a.created_at).getTime())
      analyzedByUser.set(a.user_id, list)
    }
    const analyzedUsers = analyzedByUser.size
    const secondAnalysisUsers = [...analyzedByUser.values()].filter((l) => l.length >= 2).length
    const lags: number[] = []
    for (const [userId, times] of analyzedByUser) {
      const joined = createdAtByUser.get(userId)
      if (joined === undefined) continue
      const first = Math.min(...times)
      if (first >= joined) lags.push((first - joined) / 3_600_000)
    }

    const { data: convs } = await svc.from("conversations").select("id").limit(ROW_LIMIT)
    const askThreads = ((convs ?? []) as unknown[]).length
    if (askThreads >= ROW_LIMIT) truncated = true

    const { data: purchases } = await svc
      .from("credit_purchases")
      .select("currency, amount_minor, status")
      .eq("status", "succeeded")
      .limit(ROW_LIMIT)
    const purchaseRows = ((purchases ?? []) as Array<{ currency: string; amount_minor: number; status: string }>)
    if (purchaseRows.length >= ROW_LIMIT) truncated = true
    const revenueMinorByCurrency: Record<string, number> = {}
    for (const p of purchaseRows) {
      const cur = (p.currency || "USD").toUpperCase()
      revenueMinorByCurrency[cur] = (revenueMinorByCurrency[cur] ?? 0) + (typeof p.amount_minor === "number" ? p.amount_minor : 0)
    }

    const { data: refs } = await svc.from("referral_attributions").select("status").limit(ROW_LIMIT)
    const referralsByStatus: Record<string, number> = {}
    for (const r of ((refs ?? []) as Array<{ status: string }>)) {
      const s = r.status || "unknown"
      referralsByStatus[s] = (referralsByStatus[s] ?? 0) + 1
    }

    return {
      ok: true,
      stats: {
        users: users.length,
        usersLast30d: users.filter((u) => new Date(u.created_at) >= since).length,
        analyzedUsers,
        secondAnalysisUsers,
        askThreads,
        purchasesSucceeded: purchaseRows.length,
        revenueMinorByCurrency,
        referralsByStatus,
        medianSignupToFirstAnalysisHrs: median(lags) === null ? null : Math.round((median(lags) as number) * 10) / 10,
        windowDays: WINDOW_DAYS,
        truncated,
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unavailable" }
  }
}
