"use server"

import { createClient } from "@/lib/supabase/server"
import { buildRepoRows, countBy } from "@/lib/deals/repo"
import type { RuleResult } from "@/lib/rules/result"
import { dailyCounts, medianDays, monthBuckets } from "@/lib/reports/stats"

// Reports aggregates — read-only across owned rows, bounded everywhere.
// Stage and risk reuse the Home derivation over the same queries, so the
// numbers here match the repo exactly. Spend groups finalized ledger
// consumption by operation; per-deal spend is intentionally absent (the
// ledger carries no deal_id — see research).

export interface ReportsData {
  pipeline: {
    total: number
    byStage: Record<string, number>
    byRisk: Record<string, number>
    openIssues: number
    sealedThisMonth: number
  }
  turnaround: {
    draftToSealed: { median: number | null; n: number }
    ownerToCounterparty: { median: number | null; n: number }
    inviteToSign: { median: number | null; n: number }
    requestToDecision: { median: number | null; n: number }
  }
  activity: {
    daily: Array<{ day: string; count: number }>
    byType: Array<{ type: string; count: number }>
    total30d: number
  }
  obligations: { open: number; overdue: number; completed: number; dismissed: number }
  spend: { byOperation: Array<{ operation: string; credits: number }>; total30d: number }
  signed: {
    sealedPerMonth: Array<{ month: string; count: number }>
    sealedTotal: number
    renewalQueue: Array<{ dealTitle: string; title: string; dueDate: string | null; kind: string }>
    renewalsOverdue: number
    fulfillment: { completed: number; outstanding: number; rate: number | null }
    topRules: Array<{ rule: string; deals: number }>
    topConflicts: Array<{ type: string; count: number }>
  }
}

export async function getReports(): Promise<{ ok: true; data: ReportsData } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const userId = user.id

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const today = new Date().toISOString().slice(0, 10)

  const [auditsRes, versionsRes, signersRes, decisionsRes, eventsRes, obligationsRes, ledgerRes] = await Promise.all([
    supabase.from("audits").select("id, title, deal_type, updated_at, structured_data").eq("user_id", userId).order("updated_at", { ascending: false }).limit(200),
    supabase.from("document_versions").select("audit_id, status, created_at, locked_at, owner_signed_at, counterparty_signed_at").eq("user_id", userId).limit(500),
    supabase.from("document_signers").select("created_at, signed_at").eq("status", "signed").limit(500),
    supabase.from("approval_requests").select("created_at, decided_at, verdict").neq("verdict", "pending").limit(200),
    supabase.from("activity_events").select("event_type, created_at").eq("user_id", userId).gte("created_at", thirtyDaysAgo).limit(1000),
    supabase.from("monitoring_events").select("audit_id, event_type, title, status, due_date").eq("user_id", userId).limit(500),
    supabase.from("credit_ledger").select("operation, amount, entry_type, status, created_at").eq("user_id", userId).gte("created_at", thirtyDaysAgo).limit(5000),
  ])
  if (auditsRes.error) return { ok: false, error: "We couldn't load reports. Please try again." }

  // Pipeline + risk: identical inputs to the Home repo.
  const audits = (((auditsRes.data ?? []) as Array<{ id: string; title: string | null; deal_type: string | null; updated_at: string; structured_data: { deterministicFindings?: unknown } | null }>)).map((a) => ({
    id: a.id,
    title: a.title?.trim() ? a.title : "Untitled",
    dealType: a.deal_type ?? "generic",
    updatedAt: a.updated_at,
    findings: (Array.isArray(a.structured_data?.deterministicFindings) ? a.structured_data.deterministicFindings : []) as RuleResult[],
  }))
  const versions = (((versionsRes.data ?? []) as Array<{ audit_id: string; status: string | null } | null>).filter(Boolean) as Array<{ audit_id: string; status: string | null }>).map((v) => ({ auditId: v.audit_id, status: v.status }))
  const rows = buildRepoRows(audits, versions)

  const fullVersions = ((versionsRes.data ?? []) as Array<{ locked_at: string | null; created_at: string; owner_signed_at: string | null; counterparty_signed_at: string | null }>)
  const sealedThisMonth = fullVersions.filter((v) => v.locked_at && v.locked_at >= monthStart.toISOString()).length

  // Turnaround medians from timestamp pairs.
  const signers = ((signersRes.data ?? []) as Array<{ created_at: string; signed_at: string | null }>).filter((s) => s.signed_at).map((s) => ({ from: s.created_at, to: s.signed_at }))
  const decisions = ((decisionsRes.data ?? []) as Array<{ created_at: string; decided_at: string | null }>).filter((d) => d.decided_at).map((d) => ({ from: d.created_at, to: d.decided_at as string }))

  // Activity: daily totals + by-type over 30 days.
  const events = ((eventsRes.data ?? []) as Array<{ event_type: string; created_at: string }>)
  const byType = new Map<string, number>()
  for (const e of events) byType.set(e.event_type, (byType.get(e.event_type) ?? 0) + 1)

  // Obligations snapshot (with deal scope for the signed-portfolio cut).
  const obs = ((obligationsRes.data ?? []) as Array<{ audit_id: string; event_type: string; status: string; due_date: string | null; title: string }>)
  const obligations = {
    open: obs.filter((o) => o.status === "active" && !(o.due_date && o.due_date <= today)).length,
    overdue: obs.filter((o) => o.status === "active" && o.due_date !== null && o.due_date <= today).length,
    completed: obs.filter((o) => o.status === "completed").length,
    dismissed: obs.filter((o) => o.status === "dismissed").length,
  }

  // Spend: finalized consumption only, amounts stored negative.
  const ledger = ((ledgerRes.data ?? []) as Array<{ operation: string; amount: number; entry_type: string; status: string }>)
    .filter((l) => l.entry_type === "consumption" && l.status === "finalized")
  const spendByOp = new Map<string, number>()
  for (const l of ledger) spendByOp.set(l.operation, (spendByOp.get(l.operation) ?? 0) + Math.abs(l.amount))

  // Signed portfolio (post-signature analytics): everything downstream of
  // a locked version. Sealed volume is real history from locked_at;
  // renewals and fulfillment read Tracker data scoped to signed deals;
  // the clause landscape aggregates stored findings, never re-analysis.
  const { isLockedStatus } = await import("@/lib/signing/transitions")
  const fullRows = ((versionsRes.data ?? []) as Array<{ audit_id: string; status: string | null; locked_at: string | null }>)
  const lockedAuditIds = new Set(fullRows.filter((v) => isLockedStatus(v.status ?? "")).map((v) => v.audit_id))
  const sealedStamps = fullRows.filter((v) => v.locked_at).map((v) => v.locked_at as string)
  const titles = new Map(audits.map((a) => [a.id, a.title] as const))

  const RENEWAL_TYPES = new Set(["renewal", "expiration", "notice_period"])
  const renewalEvents = obs
    .filter((o) => RENEWAL_TYPES.has(o.event_type) && o.status === "active")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
  const fulfillmentPool = obs.filter(
    (o) => lockedAuditIds.has(o.audit_id) && (o.event_type === "obligation" || o.event_type === "payment_due")
  )
  const fulfilled = fulfillmentPool.filter((o) => o.status === "completed").length
  const unfulfilled = fulfillmentPool.filter((o) => o.status === "active").length

  const ruleDeals = new Map<string, Set<string>>()
  const conflictCounts = new Map<string, number>()
  for (const a of ((auditsRes.data ?? []) as Array<{ id: string; structured_data: { deterministicFindings?: unknown; corpusConflicts?: unknown } | null }>)) {
    if (!lockedAuditIds.has(a.id)) continue
    const findings = (Array.isArray(a.structured_data?.deterministicFindings) ? a.structured_data.deterministicFindings : []) as Array<{ status?: string; ruleKey?: string }>
    for (const f of findings) {
      if (f.status === "FAIL" && typeof f.ruleKey === "string") {
        if (!ruleDeals.has(f.ruleKey)) ruleDeals.set(f.ruleKey, new Set())
        ruleDeals.get(f.ruleKey)!.add(a.id)
      }
    }
    const conflicts = (Array.isArray(a.structured_data?.corpusConflicts) ? a.structured_data.corpusConflicts : []) as Array<{ type?: unknown }>
    for (const c of conflicts) {
      if (typeof c.type === "string") conflictCounts.set(c.type, (conflictCounts.get(c.type) ?? 0) + 1)
    }
  }

  return {
    ok: true,
    data: {
      pipeline: {
        total: rows.length,
        byStage: countBy(rows, (r) => r.stage),
        byRisk: countBy(rows, (r) => r.risk),
        openIssues: rows.reduce((a, r) => a + r.openIssues, 0),
        sealedThisMonth,
      },
      turnaround: {
        draftToSealed: medianDays(fullVersions.filter((v) => v.locked_at).map((v) => ({ from: v.created_at, to: v.locked_at }))),
        ownerToCounterparty: medianDays(fullVersions.filter((v) => v.owner_signed_at && v.counterparty_signed_at).map((v) => ({ from: v.owner_signed_at, to: v.counterparty_signed_at }))),
        inviteToSign: medianDays(signers),
        requestToDecision: medianDays(decisions),
      },
      activity: {
        daily: dailyCounts(events.map((e) => e.created_at)),
        byType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 12),
        total30d: events.length,
      },
      obligations,
      spend: {
        byOperation: [...spendByOp.entries()].map(([operation, credits]) => ({ operation, credits })).sort((a, b) => b.credits - a.credits),
        total30d: [...spendByOp.values()].reduce((a, b) => a + b, 0),
      },
      signed: {
        sealedPerMonth: monthBuckets(sealedStamps),
        sealedTotal: lockedAuditIds.size,
        renewalQueue: renewalEvents.slice(0, 10).map((o) => ({
          dealTitle: titles.get(o.audit_id) ?? "Untitled",
          title: o.title || o.event_type,
          dueDate: o.due_date,
          kind: o.event_type,
        })),
        renewalsOverdue: renewalEvents.filter((o) => o.due_date !== null && o.due_date <= today).length,
        fulfillment: {
          completed: fulfilled,
          outstanding: unfulfilled,
          rate: fulfilled + unfulfilled > 0 ? Math.round((fulfilled / (fulfilled + unfulfilled)) * 100) : null,
        },
        topRules: [...ruleDeals.entries()].map(([rule, deals]) => ({ rule, deals: deals.size })).sort((a, b) => b.deals - a.deals).slice(0, 8),
        topConflicts: [...conflictCounts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 3),
      },
    },
  }
}
