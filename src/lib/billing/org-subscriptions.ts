import type { SupabaseClient } from "@supabase/supabase-js"

// Org subscriptions (pools phase 2): recurring allowance granted to a
// shared pool, use-or-lose expiry, metered org overage invoiced to the
// org owner. Mirrors the solo machinery function-for-function with the
// scope predicate swapped; solo paths are untouched.

export type OrgSubscriptionStatus = "active" | "trialing" | "past_due" | "paused" | "canceled"

export interface OrgSubscriptionRow {
  id: string
  org_id: string
  owner_user_id: string
  plan_id: string
  status: OrgSubscriptionStatus
  paddle_subscription_id: string | null
  currency: string
  monthly_allowance: number
  overage_allowed: boolean
  current_period_start: string
  current_period_end: string
  period_start_balance: number
  alerts_sent: Record<string, number[]>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function periodKey(subscriptionId: string, periodStart: string): string {
  return `allowance:${subscriptionId}:${periodStart.slice(0, 10)}`
}

export async function grantOrgAllowance(
  svc: SupabaseClient,
  sub: { id: string; org_id: string; owner_user_id: string; plan_id: string; monthly_allowance: number; current_period_start: string }
): Promise<{ granted: boolean }> {
  const key = periodKey(sub.id, sub.current_period_start)
  const { data: existing } = await svc
    .from("credit_ledger")
    .select("id")
    .eq("org_id", sub.org_id)
    .eq("idempotency_key", key)
    .maybeSingle()
  if (existing) return { granted: false }
  const { error } = await svc.from("credit_ledger").insert({
    user_id: sub.owner_user_id,
    org_id: sub.org_id,
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

async function orgConsumptionSince(svc: SupabaseClient, orgId: string, since: string): Promise<number> {
  const { data } = await svc
    .from("credit_ledger")
    .select("amount")
    .eq("org_id", orgId)
    .eq("entry_type", "consumption")
    .eq("status", "finalized")
    .gte("created_at", since)
    .limit(5000)
  return ((data ?? []) as Array<{ amount: number }>).reduce((a, r) => a + Math.abs(r.amount), 0)
}

async function orgGrantsSince(svc: SupabaseClient, orgId: string, since: string): Promise<number> {
  const { data } = await svc
    .from("credit_ledger")
    .select("amount")
    .eq("org_id", orgId)
    .eq("entry_type", "grant")
    .eq("status", "finalized")
    .gte("created_at", since)
    .limit(1000)
  return ((data ?? []) as Array<{ amount: number }>).reduce((a, r) => a + r.amount, 0)
}

export async function orgBalanceFor(svc: SupabaseClient, orgId: string): Promise<number> {
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
  const { data } = await svc
    .from("credit_ledger")
    .select("entry_type, amount, status, created_at")
    .eq("org_id", orgId)
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

export async function computeOrgOverage(
  svc: SupabaseClient,
  sub: { id: string; org_id: string; current_period_start: string; period_start_balance: number }
): Promise<number> {
  const [consumed, granted] = await Promise.all([
    orgConsumptionSince(svc, sub.org_id, sub.current_period_start),
    orgGrantsSince(svc, sub.org_id, sub.current_period_start),
  ])
  return Math.max(0, consumed - granted - Math.max(0, sub.period_start_balance))
}

export async function rolloverOrgSubscription(
  svc: SupabaseClient,
  sub: OrgSubscriptionRow
): Promise<{ rolled: boolean }> {
  if (new Date(sub.current_period_end).getTime() > Date.now()) return { rolled: false }
  if (sub.overage_allowed) {
    try {
      await invoiceOrgOverage(svc, {
        id: sub.id,
        org_id: sub.org_id,
        owner_user_id: sub.owner_user_id,
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
  const consumed = await orgConsumptionSince(svc, sub.org_id, sub.current_period_start)
  const unspent = Math.max(0, sub.monthly_allowance - consumed)
  if (unspent > 0) {
    const { error } = await svc.from("credit_ledger").insert({
      user_id: sub.owner_user_id,
      org_id: sub.org_id,
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
  const start = new Date(sub.current_period_end)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  const next = { start: start.toISOString(), end: end.toISOString() }
  const { error: periodError } = await svc
    .from("org_subscriptions")
    .update({
      current_period_start: next.start,
      current_period_end: next.end,
      alerts_sent: {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id)
  if (periodError) throw new Error(periodError.message)
  const opening = Math.max(0, await orgBalanceFor(svc, sub.org_id))
  await svc.from("org_subscriptions").update({ period_start_balance: opening }).eq("id", sub.id)
  await grantOrgAllowance(svc, {
    id: sub.id,
    org_id: sub.org_id,
    owner_user_id: sub.owner_user_id,
    plan_id: sub.plan_id,
    monthly_allowance: sub.monthly_allowance,
    current_period_start: next.start,
  })
  return { rolled: true }
}

export async function rollOverdueOrgSubscriptions(svc: SupabaseClient, limit = 200): Promise<{ rolled: number; failed: number }> {
  const { data: rows, error } = await svc
    .from("org_subscriptions")
    .select("id, org_id, owner_user_id, plan_id, status, paddle_subscription_id, currency, monthly_allowance, overage_allowed, current_period_start, current_period_end, period_start_balance, alerts_sent")
    .in("status", ["active", "trialing", "past_due"])
    .lt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  let rolled = 0
  let failed = 0
  for (const r of ((rows ?? []) as Array<{
    id: string; org_id: string; owner_user_id: string; plan_id: string; status: string;
    paddle_subscription_id: string | null; currency: string; monthly_allowance: number;
    overage_allowed: boolean; current_period_start: string; current_period_end: string;
    period_start_balance: number; alerts_sent: Record<string, number[]>;
  }>)) {
    try {
      const res = await rolloverOrgSubscription(svc, { ...r, status: r.status as OrgSubscriptionStatus })
      if (res.rolled) rolled += 1
    } catch {
      failed += 1
    }
  }
  return { rolled, failed }
}

export interface OrgOveragedInvoice {
  id: string
  status: string
}

export async function invoiceOrgOverage(
  svc: SupabaseClient,
  sub: {
    id: string
    org_id: string
    owner_user_id: string
    currency: string
    paddle_subscription_id: string | null
    current_period_start: string
    current_period_end: string
    period_start_balance: number
  }
): Promise<OrgOveragedInvoice | null> {
  const { data: existing } = await svc
    .from("org_overage_invoices")
    .select("id, status")
    .eq("org_subscription_id", sub.id)
    .eq("period_start", sub.current_period_start)
    .maybeSingle()
  if (existing) return existing as OrgOveragedInvoice
  const overage = await computeOrgOverage(svc, sub)
  if (overage <= 0) return null
  const { OVERAGE_RATES } = await import("./catalog")
  const rate = (OVERAGE_RATES as Record<string, number>)[sub.currency] ?? null
  if (!rate) return null
  const { data: created, error } = await svc
    .from("org_overage_invoices")
    .insert({
      org_id: sub.org_id,
      org_subscription_id: sub.id,
      payer_user_id: sub.owner_user_id,
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
        .from("org_overage_invoices")
        .select("id, status")
        .eq("org_subscription_id", sub.id)
        .eq("period_start", sub.current_period_start)
        .maybeSingle()
      return (raced as OrgOveragedInvoice | null) ?? null
    }
    throw new Error(error.message)
  }
  const invoice = created as OrgOveragedInvoice
  if (sub.paddle_subscription_id) {
    try {
      await settleOrgOverageInvoice(svc, invoice.id)
    } catch {
      // Pending invoices retry on the next pass.
    }
  }
  return invoice
}

export async function settleOrgOverageInvoice(
  svc: SupabaseClient,
  invoiceId: string
): Promise<{ status: string; transactionId: string | null }> {
  const { data: invoice } = await svc
    .from("org_overage_invoices")
    .select("id, org_id, payer_user_id, org_subscription_id, overage_credits, currency, status, paddle_transaction_id")
    .eq("id", invoiceId)
    .maybeSingle()
  const inv = invoice as {
    id: string; org_id: string; payer_user_id: string; org_subscription_id: string;
    overage_credits: number; currency: string; status: string; paddle_transaction_id: string | null;
  } | null
  if (!inv) throw new Error("Invoice not found")
  if (inv.status === "paid") return { status: "paid", transactionId: inv.paddle_transaction_id }
  if (inv.status === "invoiced" && inv.paddle_transaction_id) {
    return { status: "invoiced", transactionId: inv.paddle_transaction_id }
  }
  if (inv.status !== "pending") throw new Error(`Invoice is ${inv.status}`)
  const { data: sub } = await svc
    .from("org_subscriptions")
    .select("paddle_subscription_id")
    .eq("id", inv.org_subscription_id)
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
    customData: { user_id: inv.payer_user_id, org_id: inv.org_id, overage_invoice_id: inv.id },
  })
  const { data: updated, error } = await svc
    .from("org_overage_invoices")
    .update({ status: "invoiced", paddle_transaction_id: txn.transactionId })
    .eq("id", inv.id)
    .eq("status", "pending")
    .select("id")
  if (error || !updated || (Array.isArray(updated) && updated.length === 0)) {
    return { status: "invoiced", transactionId: txn.transactionId }
  }
  return { status: "invoiced", transactionId: txn.transactionId }
}

/**
 * Threshold alerts: 80/100% of the org allowance consumed mid-period.
 * Each crossing notifies the owner once per period (alerts_sent keyed by
 * period start). Called from the daily pass — cheap reads, bounded.
 */
export async function checkPoolThresholds(svc: SupabaseClient, limit = 200): Promise<{ notified: number }> {
  const { data: rows, error } = await svc
    .from("org_subscriptions")
    .select("id, org_id, owner_user_id, plan_id, monthly_allowance, current_period_start, current_period_end, alerts_sent")
    .in("status", ["active", "trialing", "past_due"])
    .limit(limit)
  if (error) throw new Error(error.message)
  let notified = 0
  const { createNotification } = await import("@/lib/notifications/store").catch(() => ({ createNotification: null as never }))
  for (const r of ((rows ?? []) as Array<{
    id: string; org_id: string; owner_user_id: string; plan_id: string; monthly_allowance: number;
    current_period_start: string; current_period_end: string; alerts_sent: Record<string, number[]>;
  }>)) {
    try {
      if (new Date(r.current_period_end).getTime() <= Date.now()) continue
      const consumed = await orgConsumptionSince(svc, r.org_id, r.current_period_start)
      const pct = r.monthly_allowance > 0 ? Math.round((consumed / r.monthly_allowance) * 100) : 0
      const key = r.current_period_start.slice(0, 10)
      const sent = (r.alerts_sent ?? {})[key] ?? []
      const crossings = [80, 100].filter((t) => pct >= t && !sent.includes(t))
      if (crossings.length === 0) continue
      if (createNotification) {
        for (const t of crossings) {
          try {
            await createNotification(svc, {
              userId: r.owner_user_id,
              type: "status",
              title: t === 100 ? "Pool allowance exhausted" : "Pool allowance at 80%",
            body: t === 100
              ? "Your pool burned through its allowance — work pauses at zero unless overage billing is on. Top up or enable overage."
              : `Your pool used ${pct}% of its allowance with time left in the period.`,
              link: "/settings",
            })
          } catch {
            // One missed alert never blocks the rest.
          }
        }
      }
      const merged = { ...(r.alerts_sent ?? {}), [key]: [...new Set([...sent, ...crossings])] }
      await svc.from("org_subscriptions").update({ alerts_sent: merged }).eq("id", r.id)
      notified += crossings.length
    } catch {
      // One bad subscription never blocks the pass.
    }
  }
  return { notified }
}

function mapStatus(raw: string): OrgSubscriptionStatus {
  if (raw === "trialing") return "trialing"
  if (raw === "past_due") return "past_due"
  if (raw === "paused") return "paused"
  if (raw === "canceled" || raw === "cancelled") return "canceled"
  return "active"
}

/**
 * Apply a Paddle subscription event to an org plan. Unknown prices and
 * non-UUID users fail closed. The payer is the attributed user, who must
 * own the org — members cannot put a subscription on the owner's card.
 */
export async function applyOrgSubscriptionEvent(
  svc: SupabaseClient,
  event: { type: string; subscriptionId: string; status: string; priceId: string; userId: string; orgId: string; periodStart: string | null; periodEnd: string | null }
): Promise<{ subscriptionId: string; status: OrgSubscriptionStatus; granted: boolean }> {
  const { planAndCurrencyForPrice, getPlan } = await import("./catalog")
  const resolved = planAndCurrencyForPrice(event.priceId)
  if (!resolved) throw new Error(`Unknown subscription price: ${event.priceId}`)
  const plan = getPlan(resolved.planId)
  if (!plan || !plan.active) throw new Error(`Unknown or inactive plan: ${resolved.planId}`)
  if (!UUID_RE.test(event.userId)) throw new Error("Missing user attribution")
  if (!UUID_RE.test(event.orgId)) throw new Error("Missing org attribution")
  const currency = resolved.currency

  const { data: membership } = await svc
    .from("organization_members")
    .select("role")
    .eq("org_id", event.orgId)
    .eq("user_id", event.userId)
    .maybeSingle()
  if ((membership as { role?: string } | null)?.role !== "owner") {
    throw new Error("Only the organization owner can subscribe the pool")
  }

  const status = mapStatus(event.status)
  const now = new Date().toISOString()
  const periodStart = event.periodStart && !Number.isNaN(new Date(event.periodStart).getTime()) ? event.periodStart : now
  const periodEnd = event.periodEnd && !Number.isNaN(new Date(event.periodEnd).getTime())
    ? event.periodEnd
    : (() => { const d = new Date(periodStart); d.setMonth(d.getMonth() + 1); return d.toISOString() })()

  const { data: existing } = await svc
    .from("org_subscriptions")
    .select("id, status")
    .eq("paddle_subscription_id", event.subscriptionId)
    .maybeSingle()
  const row = existing as { id: string; status: string } | null

  if (row) {
    const { error } = await svc
      .from("org_subscriptions")
      .update({
        plan_id: resolved.planId,
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
      const opening = Math.max(0, await orgBalanceFor(svc, event.orgId))
      await svc.from("org_subscriptions").update({ period_start_balance: opening }).eq("id", row.id)
      granted = (await grantOrgAllowance(svc, {
        id: row.id,
        org_id: event.orgId,
        owner_user_id: event.userId,
        plan_id: resolved.planId,
        monthly_allowance: plan.monthlyAllowance,
        current_period_start: periodStart,
      })).granted
    }
    return { subscriptionId: row.id, status, granted }
  }

  await svc
    .from("org_subscriptions")
    .update({ status: "canceled", canceled_at: now, updated_at: now })
    .eq("org_id", event.orgId)
    .in("status", ["active", "trialing", "past_due", "paused"])

  const { data: created, error } = await svc
    .from("org_subscriptions")
    .insert({
      org_id: event.orgId,
      owner_user_id: event.userId,
      plan_id: resolved.planId,
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
  if (error || !created) throw new Error(error?.message ?? "Could not record org subscription")
  const newId = (created as { id: string }).id
  try {
    const opening = Math.max(0, await orgBalanceFor(svc, event.orgId))
    await svc.from("org_subscriptions").update({ period_start_balance: opening }).eq("id", newId)
  } catch {
    // Snapshot failure leaves the default 0; rollover recomputes.
  }
  let granted = false
  if (status === "active" || status === "trialing") {
    granted = (await grantOrgAllowance(svc, {
      id: newId,
      org_id: event.orgId,
      owner_user_id: event.userId,
      plan_id: resolved.planId,
      monthly_allowance: plan.monthlyAllowance,
      current_period_start: periodStart,
    })).granted
  }
  return { subscriptionId: newId, status, granted }
}
