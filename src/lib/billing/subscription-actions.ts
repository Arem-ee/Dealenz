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
      .select("id, plan_id, status, currency, monthly_allowance, current_period_start, current_period_end")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
    const rows = ((subs ?? []) as Array<{
      id: string; plan_id: string; status: string; currency: string;
      monthly_allowance: number; current_period_start: string; current_period_end: string;
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
      subscription = {
        id: live.id,
        plan_id: live.plan_id,
        plan_label: plan ? `${live.plan_id} · ${plan.monthlyAllowance} credits / 30 days` : live.plan_id,
        status: live.status,
        currency: live.currency,
        monthly_allowance: live.monthly_allowance,
        used_allowance: Math.min(used, live.monthly_allowance),
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
