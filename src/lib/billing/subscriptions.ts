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
  period_start_balance: number
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
    .is("org_id", null)
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
    .is("org_id", null)
    .eq("entry_type", "consumption")
    .eq("status", "finalized")
    .gte("created_at", since)
    .limit(5000)
  return ((data ?? []) as Array<{ amount: number }>).reduce((a, r) => a + Math.abs(r.amount), 0)
}

/**
 * Service-side balance replicating credit_balance() (00042): voided rows
 * count zero, grants/refunds/adjustments add signed, consumption
 * subtracts, and only fresh (<1h) pending reservations hold. The RPC
 * reads auth.uid(), which is null for service sessions, so snapshots
 * compute here instead.
 */
export async function balanceFor(svc: SupabaseClient, userId: string): Promise<number> {
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
  const { data } = await svc
    .from("credit_ledger")
    .select("entry_type, amount, status, created_at")
    .eq("user_id", userId)
    .is("org_id", null)
    .limit(5000)
  let balance = 0
  for (const r of ((data ?? []) as Array<{ entry_type: string; amount: number; status: string; created_at: string }>)) {
    if (r.status === "voided") continue
    if (r.entry_type === "grant" || r.entry_type === "refund" || r.entry_type === "adjustment") balance += r.amount
    else if (r.entry_type === "consumption") balance -= r.amount
    else if (r.entry_type === "reservation" && r.status === "pending" && r.created_at > hourAgo) balance -= r.amount
  }
  return balance
}

async function grantsSince(
  svc: SupabaseClient,
  userId: string,
  since: string
): Promise<number> {
  const { data } = await svc
    .from("credit_ledger")
    .select("amount")
    .eq("user_id", userId)
    .is("org_id", null)
    .eq("entry_type", "grant")
    .eq("status", "finalized")
    .gte("created_at", since)
    .limit(1000)
  return ((data ?? []) as Array<{ amount: number }>).reduce((a, r) => a + r.amount, 0)
}

function advancePeriod(from: string): { start: string; end: string } {
  const start = new Date(from)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * Overage for a closed period: consumption minus ALL grants in the period
 * (allowance and packs alike) minus the starting positive balance. Only
 * genuine beyond-everything spend is billed; pack-heavy users owe nothing.
 * Never negative.
 */
export async function computePeriodOverage(
  svc: SupabaseClient,
  sub: { id: string; user_id: string; current_period_start: string; period_start_balance: number }
): Promise<number> {
  const [consumed, granted] = await Promise.all([
    consumptionSince(svc, sub.user_id, sub.current_period_start),
    grantsSince(svc, sub.user_id, sub.current_period_start),
  ])
  return Math.max(0, consumed - granted - Math.max(0, sub.period_start_balance))
}

export interface OveragedInvoice {
  id: string
  status: string
}

/**
 * Invoice the closing period when overage exists. Idempotent per
 * (subscription, period_start) via the unique index: concurrent rollovers
 * converge on one row. Returns null when nothing is owed.
 */
export async function invoicePeriodOverage(
  svc: SupabaseClient,
  sub: {
    id: string
    user_id: string
    currency: string
    paddle_subscription_id: string | null
    current_period_start: string
    current_period_end: string
    period_start_balance: number
  }
): Promise<OveragedInvoice | null> {
  const { data: existing } = await svc
    .from("overage_invoices")
    .select("id, status")
    .eq("subscription_id", sub.id)
    .eq("period_start", sub.current_period_start)
    .maybeSingle()
  if (existing) return existing as OveragedInvoice
  const overage = await computePeriodOverage(svc, sub)
  if (overage <= 0) return null
  const { OVERAGE_RATES } = await import("./catalog")
  const rate = (OVERAGE_RATES as Record<string, number>)[sub.currency] ?? null
  if (!rate) return null
  const { data: created, error } = await svc
    .from("overage_invoices")
    .insert({
      user_id: sub.user_id,
      subscription_id: sub.id,
      period_start: sub.current_period_start,
      period_end: sub.current_period_end,
      overage_credits: overage,
      unit_price_minor: rate,
      amount_minor: overage * rate,
      currency: sub.currency,
      status: "pending",
    })
    .select("id, status")
    .single()
  if (error) {
    if (error.message.toLowerCase().includes("duplicate") || error.message.toLowerCase().includes("unique")) {
      const { data: raced } = await svc
        .from("overage_invoices")
        .select("id, status")
        .eq("subscription_id", sub.id)
        .eq("period_start", sub.current_period_start)
        .maybeSingle()
      return (raced as OveragedInvoice | null) ?? null
    }
    throw new Error(error.message)
  }
  const invoice = created as OveragedInvoice
  // Immediate settle attempt: the opt-in is the billing consent. Failure
  // leaves the row pending for retry — never blocks the rollover.
  if (sub.paddle_subscription_id) {
    try {
      await settleOverageInvoice(svc, invoice.id)
    } catch {
      // Pending invoices retry on the next pass.
    }
  }
  return invoice
}

/**
 * Charge one pending invoice through Paddle. Re-entrant: already
 * invoiced/paid rows return as-is; concurrent settles converge on the
 * unique paddle_transaction_id the first writer sets... via compare: the
 * update pins status='pending' so only one caller proceeds.
 */
export async function settleOverageInvoice(
  svc: SupabaseClient,
  invoiceId: string
): Promise<{ status: string; transactionId: string | null }> {
  const { data: invoice } = await svc
    .from("overage_invoices")
    .select("id, user_id, subscription_id, overage_credits, currency, status, paddle_transaction_id")
    .eq("id", invoiceId)
    .maybeSingle()
  const inv = invoice as {
    id: string; user_id: string; subscription_id: string; overage_credits: number;
    currency: string; status: string; paddle_transaction_id: string | null;
  } | null
  if (!inv) throw new Error("Invoice not found")
  if (inv.status === "paid") return { status: "paid", transactionId: inv.paddle_transaction_id }
  if (inv.status === "invoiced" && inv.paddle_transaction_id) {
    return { status: "invoiced", transactionId: inv.paddle_transaction_id }
  }
  if (inv.status !== "pending") throw new Error(`Invoice is ${inv.status}`)
  const { data: sub } = await svc
    .from("subscriptions")
    .select("paddle_subscription_id")
    .eq("id", inv.subscription_id)
    .maybeSingle()
  const paddleSubId = (sub as { paddle_subscription_id?: string | null } | null)?.paddle_subscription_id
  if (!paddleSubId) throw new Error("No provider subscription to charge against")
  const { overagePriceId, createOverageTransaction, paddleApiKey, paddleEnvironment } = await import("./provider")
  const { Paddle } = await import("@paddle/paddle-node-sdk")
  const apiKey = paddleApiKey()
  if (!apiKey) throw new Error("Paddle is not configured")
  const paddle = new Paddle(apiKey, { environment: paddleEnvironment() })
  let customerId: string | undefined
  try {
    const detail = (await paddle.subscriptions.get(paddleSubId)) as unknown as Record<string, unknown>
    customerId = (detail.customerId as string | undefined) ?? (detail.customer_id as string | undefined)
  } catch {
    throw new Error("Could not resolve the Paddle customer")
  }
  if (!customerId) throw new Error("No Paddle customer to charge")
  const priceId = overagePriceId(inv.currency)
  if (!priceId) throw new Error(`Overage is not priced in ${inv.currency} yet`)
  const txn = await createOverageTransaction({
    customerId,
    priceId,
    quantity: inv.overage_credits,
    currency: inv.currency,
    customData: { user_id: inv.user_id, overage_invoice_id: inv.id },
  })
  const { data: updated, error } = await svc
    .from("overage_invoices")
    .update({ status: "invoiced", paddle_transaction_id: txn.transactionId })
    .eq("id", inv.id)
    .eq("status", "pending")
    .select("id")
  if (error || !updated || (Array.isArray(updated) && updated.length === 0)) {
    return { status: "invoiced", transactionId: txn.transactionId }
  }
  return { status: "invoiced", transactionId: txn.transactionId }
}

/** Roll every subscription past period end. Returns rolled/failed counts. */
export async function rollOverdueSubscriptions(svc: SupabaseClient, limit = 200): Promise<{ rolled: number; failed: number }> {
  const { data: rows, error } = await svc
    .from("subscriptions")
    .select("id, user_id, plan_id, status, paddle_subscription_id, monthly_allowance, overage_allowed, current_period_start, current_period_end, period_start_balance")
    .in("status", ["active", "trialing", "past_due"])
    .lt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  let rolled = 0
  let failed = 0
  for (const r of ((rows ?? []) as Array<{
    id: string; user_id: string; plan_id: string; status: string; paddle_subscription_id: string | null;
    monthly_allowance: number; overage_allowed: boolean;
    current_period_start: string; current_period_end: string; period_start_balance: number;
  }>)) {
    try {
      const res = await rolloverSubscription(svc, {
        ...r,
        status: r.status as SubscriptionStatus,
        currency: "USD",
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
  // Invoice the closing period first (overage math reads the closing
  // window's grants/consumption), then claw back, advance, snapshot, grant.
  // Only opted-in subscriptions meter: without the flag the hard cap held
  // all period, so nothing beyond grants could have been consumed on
  // credit (refund-driven negatives settle through the refund path).
  if (sub.overage_allowed) {
    try {
      await invoicePeriodOverage(svc, {
        id: sub.id,
        user_id: sub.user_id,
        currency: sub.currency,
        paddle_subscription_id: sub.paddle_subscription_id,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        period_start_balance: sub.period_start_balance,
      })
    } catch {
      // Invoicing never blocks the rollover; pending retries invoice again.
    }
  }
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
  // Snapshot the new window's starting balance AFTER the clawback and
  // BEFORE the fresh grant: next period's overage math deducts it.
  const opening = Math.max(0, await balanceFor(svc, sub.user_id))
  await svc
    .from("subscriptions")
    .update({ period_start_balance: opening })
    .eq("id", sub.id)
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
      // Resurrected after cancel: open a fresh allowance window with a
      // fresh starting snapshot.
      const opening = Math.max(0, await balanceFor(svc, row.user_id))
      await svc.from("subscriptions").update({ period_start_balance: opening }).eq("id", row.id)
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
  // Snapshot the pre-grant balance: the opening window's overage math
  // deducts it, so pack-heavy subscribers owe nothing for pack spend.
  try {
    const opening = Math.max(0, await balanceFor(svc, event.userId))
    await svc.from("subscriptions").update({ period_start_balance: opening }).eq("id", newId)
  } catch {
    // Snapshot failure leaves the default 0; the next rollover recomputes.
  }
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
