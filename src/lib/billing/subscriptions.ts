import type { SupabaseClient } from "@supabase/supabase-js"
import { getPlan, planAndCurrencyForPrice } from "./catalog"
import type { VerifiedSubscriptionEvent } from "./provider"

// Subscription lifecycle — service-role only. Rows are written by the
// Paddle webhook and the allowance cron, never by client sessions.
// Allowance rides the existing ledger as grants (metadata reason
// 'allowance'); use-or-lose expiry claws back only the unspent slice of
// that period's grant, so pack credits are never touched.

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "paused" | "canceled"

export interface SubscriptionRow {
  id: string
  user_id: string
  plan_id: string
  status: SubscriptionStatus
  paddle_subscription_id: string | null
  currency: string
  monthly_allowance: number
  overage_allowed: boolean
  current_period_start: string
  current_period_end: string
  canceled_at: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function periodKey(subscriptionId: string, periodStart: string): string {
  return `allowance:${subscriptionId}:${periodStart.slice(0, 10)}`
}

export async function grantAllowance(
  svc: SupabaseClient,
  sub: { id: string; user_id: string; plan_id: string; monthly_allowance: number; current_period_start: string }
): Promise<{ granted: boolean }> {
  const key = periodKey(sub.id, sub.current_period_start)
  const { data: existing } = await svc
    .from("credit_ledger")
    .select("id")
    .eq("user_id", sub.user_id)
    .eq("idempotency_key", key)
    .maybeSingle()
  if (existing) return { granted: false }
  const { error } = await svc.from("credit_ledger").insert({
    user_id: sub.user_id,
    entry_type: "grant",
    amount: sub.monthly_allowance,
    operation: null,
    status: "finalized",
    idempotency_key: key,
    metadata: { reason: "allowance", planId: sub.plan_id, subscriptionId: sub.id, periodStart: sub.current_period_start },
  })
  if (error) {
    if (error.message.toLowerCase().includes("duplicate") || error.message.toLowerCase().includes("unique")) {
      return { granted: false }
    }
    throw new Error(error.message)
  }
  return { granted: true }
}

async function consumptionSince(
  svc: SupabaseClient,
  userId: string,
  since: string
): Promise<number> {
  const { data } = await svc
    .from("credit_ledger")
    .select("amount")
    .eq("user_id", userId)
    .eq("entry_type", "consumption")
    .eq("status", "finalized")
    .gte("created_at", since)
    .limit(5000)
  return ((data ?? []) as Array<{ amount: number }>).reduce((a, r) => a + Math.abs(r.amount), 0)
}

function advancePeriod(from: string): { start: string; end: string } {
  const start = new Date(from)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** Roll every subscription past period end. Returns rolled/failed counts. */
export async function rollOverdueSubscriptions(svc: SupabaseClient, limit = 200): Promise<{ rolled: number; failed: number }> {
  const { data: rows, error } = await svc
    .from("subscriptions")
    .select("id, user_id, plan_id, status, monthly_allowance, current_period_start, current_period_end")
    .in("status", ["active", "trialing", "past_due"])
    .lt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  let rolled = 0
  let failed = 0
  for (const r of ((rows ?? []) as Array<{
    id: string; user_id: string; plan_id: string; status: string;
    monthly_allowance: number; current_period_start: string; current_period_end: string;
  }>)) {
    try {
      const res = await rolloverSubscription(svc, {
        ...r,
        status: r.status as SubscriptionStatus,
        paddle_subscription_id: null,
        currency: "USD",
        overage_allowed: false,
        canceled_at: null,
      })
      if (res.rolled) rolled += 1
    } catch {
      failed += 1
    }
  }
  return { rolled, failed }
}

/**
 * Roll one subscription past its period end: claw back the unspent slice
 * of the closing grant (capped at granted-minus-consumed, so packs are
 * never touched), grant the new period, advance the window. Idempotent
 * per period via the grant's idempotency key.
 */
export async function rolloverSubscription(
  svc: SupabaseClient,
  sub: SubscriptionRow
): Promise<{ rolled: boolean }> {
  if (new Date(sub.current_period_end).getTime() > Date.now()) return { rolled: false }
  const consumed = await consumptionSince(svc, sub.user_id, sub.current_period_start)
  const unspent = Math.max(0, sub.monthly_allowance - consumed)
  if (unspent > 0) {
    const { error } = await svc.from("credit_ledger").insert({
      user_id: sub.user_id,
      entry_type: "adjustment",
      amount: -unspent,
      operation: null,
      status: "finalized",
      idempotency_key: `allowance-expiry:${sub.id}:${sub.current_period_start.slice(0, 10)}`,
      metadata: { reason: "allowance_expiry", planId: sub.plan_id, subscriptionId: sub.id, periodStart: sub.current_period_start, unspent },
    })
    if (error && !error.message.toLowerCase().includes("duplicate") && !error.message.toLowerCase().includes("unique")) {
      throw new Error(error.message)
    }
  }
  const next = advancePeriod(sub.current_period_end)
  const { error: periodError } = await svc
    .from("subscriptions")
    .update({ current_period_start: next.start, current_period_end: next.end, updated_at: new Date().toISOString() })
    .eq("id", sub.id)
  if (periodError) throw new Error(periodError.message)
  await grantAllowance(svc, {
    id: sub.id,
    user_id: sub.user_id,
    plan_id: sub.plan_id,
    monthly_allowance: sub.monthly_allowance,
    current_period_start: next.start,
  })
  return { rolled: true }
}

function mapStatus(raw: string): SubscriptionStatus {
  if (raw === "trialing") return "trialing"
  if (raw === "past_due") return "past_due"
  if (raw === "paused") return "paused"
  if (raw === "canceled" || raw === "cancelled") return "canceled"
  return "active"
}

/**
 * Apply a Paddle subscription event. Unknown prices and non-UUID users
 * fail closed (the route turns these into 400s — Paddle retries, a human
 * follows up). First activation also drops the opening allowance grant.
 */
export async function applySubscriptionEvent(
  svc: SupabaseClient,
  event: VerifiedSubscriptionEvent
): Promise<{ subscriptionId: string; status: SubscriptionStatus; granted: boolean }> {
  // Plan AND currency resolve from the price itself — never trusted from
  // the client, never defaulted.
  const resolved = planAndCurrencyForPrice(event.priceId)
  if (!resolved) throw new Error(`Unknown subscription price: ${event.priceId}`)
  const plan = getPlan(resolved.planId)
  if (!plan || !plan.active) throw new Error(`Unknown or inactive plan: ${resolved.planId}`)
  if (!UUID_RE.test(event.userId)) throw new Error("Missing user attribution")
  const currency = resolved.currency

  const status = mapStatus(event.status)
  const now = new Date().toISOString()
  const planId = resolved.planId
  const periodStart = event.periodStart && !Number.isNaN(new Date(event.periodStart).getTime()) ? event.periodStart : now
  const periodEnd = event.periodEnd && !Number.isNaN(new Date(event.periodEnd).getTime()) ? event.periodEnd : advancePeriod(periodStart).end

  const { data: existing } = await svc
    .from("subscriptions")
    .select("id, user_id, plan_id, status, monthly_allowance, current_period_start")
    .eq("paddle_subscription_id", event.subscriptionId)
    .maybeSingle()
  const row = existing as { id: string; user_id: string; plan_id: string; status: string; monthly_allowance: number; current_period_start: string } | null

  if (row) {
    const { error } = await svc
      .from("subscriptions")
      .update({
        plan_id: planId,
        status,
        currency,
        monthly_allowance: plan.monthlyAllowance,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        canceled_at: status === "canceled" ? now : null,
        updated_at: now,
      })
      .eq("id", row.id)
    if (error) throw new Error(error.message)
    let granted = false
    if ((status === "active" || status === "trialing") && row.status === "canceled") {
      // Resurrected after cancel: open a fresh allowance window.
      granted = (await grantAllowance(svc, {
        id: row.id,
        user_id: row.user_id,
        plan_id: planId,
        monthly_allowance: plan.monthlyAllowance,
        current_period_start: periodStart,
      })).granted
    }
    return { subscriptionId: row.id, status, granted }
  }

  // One live subscription per user: a new signup supersedes any previous
  // live row (upgrade/downgrade path until proration lands in phase 2).
  await svc
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: now, updated_at: now })
    .eq("user_id", event.userId)
    .in("status", ["active", "trialing", "past_due", "paused"])

  const { data: created, error } = await svc
    .from("subscriptions")
    .insert({
      user_id: event.userId,
      plan_id: planId,
      status,
      paddle_subscription_id: event.subscriptionId,
      currency,
      monthly_allowance: plan.monthlyAllowance,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      canceled_at: status === "canceled" ? now : null,
    })
    .select("id")
    .single()
  if (error || !created) throw new Error(error?.message ?? "Could not record subscription")
  const newId = (created as { id: string }).id
  let granted = false
  if (status === "active" || status === "trialing") {
    granted = (await grantAllowance(svc, {
      id: newId,
      user_id: event.userId,
      plan_id: planId,
      monthly_allowance: plan.monthlyAllowance,
      current_period_start: periodStart,
    })).granted
  }
  return { subscriptionId: newId, status, granted }
}
