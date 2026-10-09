// Metric catalog — composed analytics over owned rows (D1–D5).
//
// Every metric is a fixed server-declared query with user-composed filters
// (deal types, since window). Users never write SQL; execution always runs
// through the caller's authenticated client so table RLS scopes custom
// runs identically to static aggregates. Row cap 500, bounded date
// windows, no service-role reads.

import type { SupabaseClient } from "@supabase/supabase-js"
import { locateSpan } from "@/lib/evidence/locate"

export const ANALYTICS_ROW_CAP = 500
export const ANALYTICS_WINDOWS = [30, 90, 365] as const

export interface MetricParams {
  dealTypes: string[]
  sinceDays: number
}

export interface MetricColumn {
  key: string
  label: string
  numeric?: boolean
}

export interface MetricResult {
  columns: MetricColumn[]
  rows: Array<Record<string, string | number>>
  truncated: boolean
}

export interface MetricDef {
  id: string
  title: string
  desc: string
  run: (
    client: SupabaseClient,
    userId: string,
    params: MetricParams
  ) => Promise<MetricResult>
}

type Client = SupabaseClient

function cutoff(sinceDays: number): string {
  const days = ANALYTICS_WINDOWS.includes(sinceDays as (typeof ANALYTICS_WINDOWS)[number])
    ? sinceDays
    : 90
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

async function auditDealTypes(
  client: Client,
  userId: string,
  auditIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  if (auditIds.length === 0) return map
  const { data } = await client
    .from("audits")
    .select("id, deal_type")
    .eq("user_id", userId)
    .in("id", [...new Set(auditIds)].slice(0, 500))
  for (const a of ((data ?? []) as Array<{ id: string; deal_type: string | null }>)) {
    map.set(a.id, a.deal_type)
  }
  return map
}

function typeAllowed(dealType: string | null | undefined, dealTypes: string[]): boolean {
  if (dealTypes.length === 0) return true
  return !!dealType && dealTypes.includes(dealType)
}

/**
 * Fallback acceptance (pairing D7 paying out): per clause+rung, how often
 * offered language EXACT-lands in a signed version of the same deal.
 * Rung text resolves to current heads and is labeled as such — bodies may
 * have moved since the offer.
 */
async function runFallbackAcceptance(
  client: Client,
  userId: string,
  params: MetricParams
): Promise<MetricResult> {
  const since = cutoff(params.sinceDays)
  const { data: rounds } = await client
    .from("negotiation_rounds")
    .select("id, audit_id")
    .eq("user_id", userId)
    .gte("created_at", since)
    .limit(200)
  const roundRows = (rounds ?? []) as Array<{ id: string; audit_id: string }>
  if (roundRows.length === 0) {
    return { columns: acceptanceColumns(), rows: [], truncated: false }
  }
  const roundAudit = new Map(roundRows.map((r) => [r.id, r.audit_id]))
  const { data: positions } = await client
    .from("round_clause_positions")
    .select("round_id, clause_id, outcome, rung, created_at")
    .in("round_id", roundRows.map((r) => r.id))
    .eq("outcome", "fallback")
    .gte("created_at", since)
    .limit(ANALYTICS_ROW_CAP)
  const offers = (positions ?? []) as Array<{
    round_id: string; clause_id: string; outcome: string; rung: number | null; created_at: string
  }>
  const dealTypes = await auditDealTypes(client, userId, roundRows.map((r) => r.audit_id))
  const { data: libRows } = await client
    .from("library_clauses")
    .select("key, variant, version, body, status")
    .eq("user_id", userId)
    .limit(500)
  // Latest fallback head per key for landing checks (labeled current).
  const heads = new Map<string, { body: string; version: number }>()
  for (const r of ((libRows ?? []) as Array<{
    key: string; variant: string; version: number; body: string; status: string
  }>)) {
    if (r.variant !== "fallback") continue
    if (r.status !== "active" && r.status !== "deprecated") continue
    const cur = heads.get(r.key)
    if (!cur || r.version > cur.version) heads.set(r.key, { body: r.body, version: r.version })
  }
  const { data: signed } = await client
    .from("document_versions")
    .select("audit_id, content")
    .eq("user_id", userId)
    .in("status", ["fully_signed", "locked"])
    .limit(200)
  const signedByAudit = new Map<string, string[]>()
  for (const v of ((signed ?? []) as Array<{ audit_id: string; content: string | null }>)) {
    if (!v.content) continue
    const list = signedByAudit.get(v.audit_id) ?? []
    if (list.length < 3) list.push(v.content.slice(0, 100_000))
    signedByAudit.set(v.audit_id, list)
  }
  const stats = new Map<string, { clauseId: string; rung: number; offered: number; landed: number }>()
  let truncated = false
  for (const o of offers.slice(0, 200)) {
    const auditId = roundAudit.get(o.round_id)
    if (!auditId) continue
    if (!typeAllowed(dealTypes.get(auditId) ?? null, params.dealTypes)) continue
    const rung = typeof o.rung === "number" ? o.rung : 0
    const head = heads.get(`std:${o.clause_id}`)
    const key = `${o.clause_id}::${rung}`
    const stat = stats.get(key) ?? { clauseId: o.clause_id, rung, offered: 0, landed: 0 }
    stat.offered += 1
    if (head) {
      const texts = signedByAudit.get(auditId) ?? []
      if (texts.some((t) => locateSpan(t, head.body).kind === "EXACT")) stat.landed += 1
    }
    stats.set(key, stat)
    if (stats.size >= ANALYTICS_ROW_CAP) {
      truncated = true
      break
    }
  }
  const rows = [...stats.values()]
    .map((s) => ({
      clause: s.clauseId,
      rung: s.rung,
      offered: s.offered,
      landed: s.landed,
      acceptance_pct: s.offered > 0 ? Math.round((s.landed / s.offered) * 100) : 0,
    }))
    .sort((a, b) => b.offered - a.offered || a.clause.localeCompare(b.clause))
  return { columns: acceptanceColumns(), rows, truncated }
}

function acceptanceColumns(): MetricColumn[] {
  return [
    { key: "clause", label: "Clause" },
    { key: "rung", label: "Rung", numeric: true },
    { key: "offered", label: "Offered", numeric: true },
    { key: "landed", label: "Landed exact", numeric: true },
    { key: "acceptance_pct", label: "Accept %" , numeric: true },
  ]
}

/** Clause pushback: where ladders engage, exhaust, route, or get dismissed. */
async function runClausePushback(
  client: Client,
  userId: string,
  params: MetricParams
): Promise<MetricResult> {
  const since = cutoff(params.sinceDays)
  const { data: rounds } = await client
    .from("negotiation_rounds")
    .select("id, audit_id")
    .eq("user_id", userId)
    .gte("created_at", since)
    .limit(200)
  const roundRows = (rounds ?? []) as Array<{ id: string; audit_id: string }>
  const roundAudit = new Map(roundRows.map((r) => [r.id, r.audit_id]))
  const dealTypes = await auditDealTypes(client, userId, roundRows.map((r) => r.audit_id))
  const { data: positions } = await client
    .from("round_clause_positions")
    .select("round_id, clause_id, outcome")
    .in("round_id", roundRows.length > 0 ? roundRows.map((r) => r.id) : ["00000000-0000-0000-0000-000000000000"])
    .gte("created_at", since)
    .limit(ANALYTICS_ROW_CAP)
  const { data: states } = await client
    .from("clause_states")
    .select("clause_id, status, audit_id")
    .eq("user_id", userId)
    .gte("updated_at", since)
    .limit(ANALYTICS_ROW_CAP)
  const stats = new Map<string, { clause: string; fallback: number; escalate: number; route: number; dismissed: number; accepted: number }>()
  const bump = (clause: string, field: "fallback" | "escalate" | "route" | "dismissed" | "accepted") => {
    const s = stats.get(clause) ?? { clause, fallback: 0, escalate: 0, route: 0, dismissed: 0, accepted: 0 }
    s[field] += 1
    stats.set(clause, s)
  }
  for (const p of ((positions ?? []) as Array<{ round_id: string; clause_id: string; outcome: string }>)) {
    const auditId = roundAudit.get(p.round_id)
    if (!typeAllowed(auditId ? dealTypes.get(auditId) ?? null : null, params.dealTypes)) continue
    if (p.outcome === "fallback" || p.outcome === "escalate" || p.outcome === "route" || p.outcome === "accept") {
      bump(p.clause_id, p.outcome === "accept" ? "accepted" : p.outcome)
    }
  }
  const stateAudits = [...new Set(((states ?? []) as Array<{ audit_id: string }>).map((s) => s.audit_id))]
  const stateTypes = await auditDealTypes(client, userId, stateAudits)
  for (const s of ((states ?? []) as Array<{ clause_id: string; status: string; audit_id: string }>)) {
    if (!typeAllowed(stateTypes.get(s.audit_id) ?? null, params.dealTypes)) continue
    if (s.status === "dismissed") bump(s.clause_id, "dismissed")
    if (s.status === "accepted") bump(s.clause_id, "accepted")
  }
  const rows = [...stats.values()]
    .map((s) => ({ ...s, pushback: s.fallback + s.escalate + s.route + s.dismissed }))
    .sort((a, b) => b.pushback - a.pushback || a.clause.localeCompare(b.clause))
    .slice(0, ANALYTICS_ROW_CAP)
  return {
    columns: [
      { key: "clause", label: "Clause" },
      { key: "fallback", label: "Fallbacks", numeric: true },
      { key: "escalate", label: "Escalated", numeric: true },
      { key: "route", label: "Routed", numeric: true },
      { key: "dismissed", label: "Dismissed", numeric: true },
      { key: "accepted", label: "Accepted", numeric: true },
      { key: "pushback", label: "Pushback", numeric: true },
    ],
    rows,
    truncated: false,
  }
}

/** Escalation outcomes from the decision queue. */
async function runEscalations(
  client: Client,
  userId: string,
  params: MetricParams
): Promise<MetricResult> {
  const since = cutoff(params.sinceDays)
  const { data } = await client
    .from("approval_requests")
    .select("verdict, decided_at, created_at")
    .eq("user_id", userId)
    .eq("subject_type", "escalation")
    .gte("created_at", since)
    .limit(ANALYTICS_ROW_CAP)
  const rows = (data ?? []) as Array<{ verdict: string; decided_at: string | null; created_at: string }>
  const filed = rows.length
  const approved = rows.filter((r) => r.verdict === "approved").length
  const rejected = rows.filter((r) => r.verdict === "rejected").length
  const pending = rows.filter((r) => r.verdict === "pending").length
  const decidedDays = rows
    .filter((r) => r.decided_at)
    .map((r) => (new Date(r.decided_at as string).getTime() - new Date(r.created_at).getTime()) / 86_400_000)
  const medianDays = decidedDays.length > 0
    ? Math.round(decidedDays.sort((a, b) => a - b)[Math.floor(decidedDays.length / 2)]! * 10) / 10
    : 0
  return {
    columns: [
      { key: "filed", label: "Filed", numeric: true },
      { key: "approved", label: "Approved", numeric: true },
      { key: "rejected", label: "Rejected", numeric: true },
      { key: "pending", label: "Pending", numeric: true },
      { key: "median_days_to_decision", label: "Median days", numeric: true },
    ],
    rows: [{ filed, approved, rejected, pending, median_days_to_decision: medianDays }],
    truncated: false,
  }
}

/** Negotiation pace: rounds per deal and time to accept. */
async function runNegotiationPace(
  client: Client,
  userId: string,
  params: MetricParams
): Promise<MetricResult> {
  const since = cutoff(params.sinceDays)
  const { data: rounds } = await client
    .from("negotiation_rounds")
    .select("id, audit_id, status, stance, created_at, decided_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .limit(ANALYTICS_ROW_CAP)
  const roundRows = (rounds ?? []) as Array<{
    id: string; audit_id: string; status: string; stance: string; created_at: string; decided_at: string | null
  }>
  const dealTypes = await auditDealTypes(client, userId, roundRows.map((r) => r.audit_id))
  const filtered = roundRows.filter((r) => typeAllowed(dealTypes.get(r.audit_id) ?? null, params.dealTypes))
  const byDeal = new Map<string, typeof filtered>()
  for (const r of filtered) {
    const list = byDeal.get(r.audit_id) ?? []
    list.push(r)
    byDeal.set(r.audit_id, list)
  }
  const toAccept: number[] = []
  for (const list of byDeal.values()) {
    const accepted = list.find((r) => r.status === "accepted")
    if (accepted) {
      const first = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]!
      toAccept.push((new Date(accepted.decided_at ?? accepted.created_at).getTime() - new Date(first.created_at).getTime()) / 86_400_000)
    }
  }
  const median = (xs: number[]) => xs.length === 0 ? 0 : Math.round(xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]! * 10) / 10
  return {
    columns: [
      { key: "deals", label: "Deals", numeric: true },
      { key: "rounds", label: "Rounds", numeric: true },
      { key: "median_rounds_per_deal", label: "Median rounds/deal", numeric: true },
      { key: "median_days_to_accept", label: "Median days to accept", numeric: true },
    ],
    rows: [{
      deals: byDeal.size,
      rounds: filtered.length,
      median_rounds_per_deal: median([...byDeal.values()].map((l) => l.length)),
      median_days_to_accept: median(toAccept),
    }],
    truncated: false,
  }
}

/** Library velocity: what the library holds and what actually ships. */
async function runLibraryVelocity(
  client: Client,
  userId: string,
  params: MetricParams
): Promise<MetricResult> {
  // Library-wide inventory: deal and date filters don't apply. Referenced
  // so the runner signature stays uniform across metrics.
  void params
  const { data } = await client
    .from("library_clauses")
    .select("key, variant, version, status, use_count")
    .eq("user_id", userId)
    .limit(ANALYTICS_ROW_CAP)
  const byKey = new Map<string, { line: string; versions: number; used: number; retired: boolean }>()
  for (const r of ((data ?? []) as Array<{
    key: string; variant: string; version: number; status: string; use_count: number
  }>)) {
    const entry = byKey.get(r.key) ?? { line: r.key, versions: 0, used: 0, retired: true }
    entry.versions += 1
    entry.used = Math.max(entry.used, r.use_count ?? 0)
    if (r.status === "active") entry.retired = false
    byKey.set(r.key, entry)
  }
  const rows = [...byKey.values()]
    .sort((a, b) => b.used - a.used || a.line.localeCompare(b.line))
    .slice(0, ANALYTICS_ROW_CAP)
  return {
    columns: [
      { key: "line", label: "Line" },
      { key: "versions", label: "Versions", numeric: true },
      { key: "used", label: "Shipped", numeric: true },
      { key: "retired", label: "Retired" },
    ],
    rows: rows.map((r) => ({ ...r, retired: r.retired ? "yes" : "no" })),
    truncated: false,
  }
}

export const METRICS: MetricDef[] = [
  {
    id: "fallback_acceptance",
    title: "Fallback acceptance",
    desc: "Offered vs EXACT-landed fallback rungs per clause — which rung closes.",
    run: runFallbackAcceptance,
  },
  {
    id: "clause_pushback",
    title: "Clause pushback",
    desc: "Where ladders engage, exhaust, route, or get dismissed per clause.",
    run: runClausePushback,
  },
  {
    id: "escalations",
    title: "Escalations",
    desc: "Filed, decided, and pending clause escalations with median time to decision.",
    run: runEscalations,
  },
  {
    id: "negotiation_pace",
    title: "Negotiation pace",
    desc: "Rounds per deal and median days to accept, trailing window.",
    run: runNegotiationPace,
  },
  {
    id: "library_velocity",
    title: "Library velocity",
    desc: "Library lines by versions and shipped usage.",
    run: runLibraryVelocity,
  },
]

export function metricById(id: string): MetricDef | null {
  return METRICS.find((m) => m.id === id) ?? null
}
