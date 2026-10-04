"use server"

import { createClient } from "@/lib/supabase/server"
import { toActionFailure } from "@/lib/action-result"
import { getPlan, SUBSCRIPTION_PLANS, type Currency } from "@/lib/billing/catalog"
import { isSubscriptionCheckoutConfigured, paddleApiKey, paddleEnvironment, planPriceId } from "@/lib/billing/provider"

// Subscription storefront actions: billing state for Settings, hosted
// checkout parameters, and cancellation at period end. Money moves only
// through Paddle; the webhook is the source of truth for rows.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface BillingSubscription {
  id: string
  plan_id: string
  plan_label: string
  status: string
  currency: string
  monthly_allowance: number
  used_allowance: number
  overage_credits: number
  overage_allowed: boolean
  period_end: string
  renews: boolean
}

export async function getBillingState() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }

    const { data: subs } = await supabase
      .from("subscriptions")
      .select("id, plan_id, status, currency, monthly_allowance, overage_allowed, current_period_start, current_period_end, period_start_balance")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
    const rows = ((subs ?? []) as Array<{
      id: string; plan_id: string; status: string; currency: string;
      monthly_allowance: number; overage_allowed: boolean;
      current_period_start: string; current_period_end: string; period_start_balance: number;
    }>)
    const live = rows.find((r) => ["active", "trialing", "past_due", "paused"].includes(r.status)) ?? null

    let balance: number | null = null
    try {
      const { data } = await supabase.rpc("credit_balance" as never)
      const arr = data as Array<{ balance?: unknown }> | { balance?: unknown } | null
      const first = Array.isArray(arr) ? arr[0] : arr
      if (first && typeof first.balance === "number") balance = first.balance
    } catch {
      // Balance is display-only here; the top bar owns the canonical read.
    }

    let used = 0
    if (live) {
      const { data: spent } = await supabase
        .from("credit_ledger")
        .select("amount")
        .eq("user_id", user.id)
        .eq("entry_type", "consumption")
        .eq("status", "finalized")
        .gte("created_at", live.current_period_start)
        .limit(5000)
      used = ((spent ?? []) as Array<{ amount: number }>).reduce((a, r) => a + Math.abs(r.amount), 0)
    }

    const { data: purchases } = await supabase
      .from("credit_purchases")
      .select("package_id, currency, amount_minor, credits, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    const plans = SUBSCRIPTION_PLANS.filter((p) => p.active).map((p) => ({
      id: p.id,
      monthlyAllowance: p.monthlyAllowance,
      description: p.description,
    }))

    let subscription: BillingSubscription | null = null
    if (live) {
      const plan = getPlan(live.plan_id)
      // Uncapped period usage + live overage: overage = consumption minus
      // ALL period grants minus starting positive balance (same formula
      // the invoicing pass uses).
      const { data: periodRows } = await supabase
        .from("credit_ledger")
        .select("entry_type, amount, status")
        .eq("user_id", user.id)
        .gte("created_at", live.current_period_start)
        .limit(5000)
      let consumed = 0
      let granted = 0
      for (const r of ((periodRows ?? []) as Array<{ entry_type: string; amount: number; status: string }>)) {
        if (r.entry_type === "consumption" && r.status === "finalized") consumed += Math.abs(r.amount)
        else if (r.entry_type === "grant" && r.status === "finalized") granted += r.amount
      }
      const overage = Math.max(0, consumed - granted - Math.max(0, live.period_start_balance))
      subscription = {
        id: live.id,
        plan_id: live.plan_id,
        plan_label: plan ? `${live.plan_id} · ${plan.monthlyAllowance} credits / 30 days` : live.plan_id,
        status: live.status,
        currency: live.currency,
        monthly_allowance: live.monthly_allowance,
        used_allowance: used,
        overage_credits: overage,
        overage_allowed: live.overage_allowed,
        period_end: live.current_period_end,
        renews: live.status !== "canceled",
      }
    }
    return {
      ok: true as const,
      subscription,
      balance,
      plans,
      checkoutConfigured: isSubscriptionCheckoutConfigured(),
      purchases: ((purchases ?? []) as Array<{ package_id: string; currency: string; amount_minor: number; credits: number; status: string; created_at: string }>),
    }
  } catch (e) {
    return toActionFailure(e, "Could not load billing.") as never
  }
}

export async function startSubscriptionCheckout(input: { planId: string; currency: string }) {
  try {
    const plan = getPlan(input.planId)
    if (!plan || !plan.active) return { ok: false as const, error: "Unknown plan." }
    if (input.currency !== "USD" && input.currency !== "GBP" && input.currency !== "EUR") {
      return { ok: false as const, error: "Unsupported currency." }
    }
    const currency = input.currency as Currency
    if (!isSubscriptionCheckoutConfigured()) {
      return { ok: false as const, error: "Subscriptions aren't open yet — top up with a pack anytime." }
    }
    const priceId = planPriceId(plan.id, currency)
    if (!priceId) return { ok: false as const, error: `That plan isn't priced in ${currency} yet.` }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Verify your email before subscribing." }
    if (!UUID_RE.test(user.id)) return { ok: false as const, error: "Invalid account." }
    const { data: live } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due", "paused"])
      .maybeSingle()
    if (live) return { ok: false as const, error: "You already have a live subscription — cancel it first to switch plans." }
    return {
      ok: true as const,
      priceId,
      email: user.email ?? "",
      customData: { user_id: user.id, plan_id: plan.id },
      clientToken: (process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "").trim(),
      environment: (process.env.PADDLE_ENVIRONMENT ?? "").trim().toLowerCase() === "sandbox" ? "sandbox" : "production",
    }
  } catch (e) {
    return toActionFailure(e, "Could not start checkout.") as never
  }
}

export async function cancelSubscription() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Verify your email first." }
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, paddle_subscription_id, status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due", "paused"])
      .maybeSingle()
    const row = sub as { id: string; paddle_subscription_id: string | null; status: string } | null
    if (!row) return { ok: false as const, error: "No live subscription to cancel." }
    if (!row.paddle_subscription_id) return { ok: false as const, error: "That subscription was recorded without a provider id — contact support to cancel." }
    const apiKey = paddleApiKey()
    if (!apiKey) return { ok: false as const, error: "Billing is not configured." }
    const { Paddle } = await import("@paddle/paddle-node-sdk")
    const paddle = new Paddle(apiKey, { environment: paddleEnvironment() })
    // End-of-term cancel: allowance runs to period end, then stops. The
    // webhook confirms and flips the row — it stays the source of truth.
    await paddle.subscriptions.cancel(row.paddle_subscription_id, { effectiveFrom: "next_billing_period" })
    return { ok: true as const, endsAtPeriodEnd: true }
  } catch (e) {
    return toActionFailure(e, "Could not cancel. Your subscription is unchanged — try again or cancel in Paddle.") as never
  }
}

export interface OverageInvoiceView {
  id: string
  period_start: string
  period_end: string
  overage_credits: number
  amount_minor: number
  currency: string
  status: string
  paddle_transaction_id: string | null
}

/** Overage opt-in/out: explicit user action only, never automatic. */
export async function setOverageAllowed(optIn: boolean) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Verify your email first." }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const svc = createServiceClient(url, key)
    const { data: sub } = await svc
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due"])
      .maybeSingle()
    if (!sub) return { ok: false as const, error: "No live subscription to change." }
    const { error } = await svc
      .from("subscriptions")
      .update({ overage_allowed: optIn, updated_at: new Date().toISOString() })
      .eq("id", (sub as { id: string }).id)
      .eq("user_id", user.id)
    if (error) throw new Error(error.message)
    try {
      const { createNotification } = await import("@/lib/notifications/store")
      await createNotification(svc, {
        userId: user.id,
        type: "status",
        title: optIn ? "Overage billing on" : "Overage billing off",
        body: optIn
          ? "Work continues past your allowance and overage invoices each period. Turn it off anytime."
          : "Hard cap restored — work pauses when the balance runs out.",
        link: "/settings",
      })
    } catch {
      // The flag stands regardless; the notification is best-effort.
    }
    return { ok: true as const, overageAllowed: optIn }
  } catch (e) {
    return toActionFailure(e, "Could not change overage billing.") as never
  }
}

export async function listOverageInvoices() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const { data, error } = await supabase
      .from("overage_invoices")
      .select("id, period_start, period_end, overage_credits, amount_minor, currency, status, paddle_transaction_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
    if (error) {
      if (error.message.includes("overage_invoices")) return { ok: true as const, invoices: [] as OverageInvoiceView[] }
      throw new Error(error.message)
    }
    return { ok: true as const, invoices: ((data ?? []) as OverageInvoiceView[]) }
  } catch (e) {
    return toActionFailure(e, "Could not load invoices.") as never
  }
}

/** Pay one pending invoice now (auto-settle at rollover already tried). */
export async function settleOverageInvoiceAction(invoiceId: string) {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId)) {
      return { ok: false as const, error: "Invalid invoice." }
    }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Verify your email first." }
    const { data: invoice } = await supabase
      .from("overage_invoices")
      .select("id, user_id, status")
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!invoice) return { ok: false as const, error: "Invoice not found." }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const svc = createServiceClient(url, key)
    const { settleOverageInvoice } = await import("@/lib/billing/subscriptions")
    const res = await settleOverageInvoice(svc, invoiceId)
    return { ok: true as const, ...res }
  } catch (e) {
    return toActionFailure(e, "Payment failed — the invoice is unchanged, try again.") as never
  }
}
