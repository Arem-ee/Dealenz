"use server"

import { createClient } from "@/lib/supabase/server"
import { toActionFailure } from "@/lib/action-result"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getPlan, SUBSCRIPTION_PLANS, type Currency } from "@/lib/billing/catalog"
import { isSubscriptionCheckoutConfigured, paddleApiKey, paddleEnvironment, planPriceId } from "@/lib/billing/provider"

// Org plan storefront actions: owner-only mutations, member reads.
// Packs-funded pools keep working with no plan; these add the recurring
// leg (allowance + metered overage invoiced to the owner).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function ownerOrg(orgId: string, userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle()
  return (data as { role?: string } | null)?.role === "owner"
}

export interface OrgBillingState {
  subscription: {
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
  } | null
  poolBalance: number | null
  plans: Array<{ id: string; monthlyAllowance: number; description: string }>
  checkoutConfigured: boolean
  invoices: Array<{
    id: string
    period_start: string
    period_end: string
    overage_credits: number
    amount_minor: number
    currency: string
    status: string
  }>
}

export async function getOrgBillingState(orgId: string) {
  try {
    if (!UUID_RE.test(orgId)) return { ok: false as const, error: "Invalid organization." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const svc = createServiceClient(url, key)
    const { data: sub } = await svc
      .from("org_subscriptions")
      .select("id, plan_id, status, currency, monthly_allowance, overage_allowed, current_period_start, current_period_end, period_start_balance")
      .eq("org_id", orgId)
      .in("status", ["active", "trialing", "past_due", "paused"])
      .maybeSingle()
    const row = sub as OrgBillingState["subscription"] & {
      current_period_start: string
      period_start_balance: number
      overage_allowed: boolean
      current_period_end: string
    } | null

    let poolBalance: number | null = null
    try {
      const { data } = await supabase.rpc("credit_balance" as never, { p_org_id: orgId } as never)
      const first = (Array.isArray(data) ? data[0] : data) as { balance?: unknown } | null
      if (first && typeof first.balance === "number") poolBalance = Math.floor(first.balance)
    } catch {
      poolBalance = null
    }

    let subscription: OrgBillingState["subscription"] = null
    if (row) {
      const plan = getPlan(row.plan_id)
      const { data: periodRows } = await svc
        .from("credit_ledger")
        .select("entry_type, amount, status")
        .eq("org_id", orgId)
        .gte("created_at", (row as { current_period_start: string }).current_period_start)
        .limit(5000)
      let consumed = 0
      let granted = 0
      for (const r of ((periodRows ?? []) as Array<{ entry_type: string; amount: number; status: string }>)) {
        if (r.entry_type === "consumption" && r.status === "finalized") consumed += Math.abs(r.amount)
        else if (r.entry_type === "grant" && r.status === "finalized") granted += r.amount
      }
      const opening = (row as { period_start_balance: number }).period_start_balance
      subscription = {
        id: row.id,
        plan_id: row.plan_id,
        plan_label: plan ? `${row.plan_id} · ${plan.monthlyAllowance} credits / 30 days` : row.plan_id,
        status: row.status,
        currency: row.currency,
        monthly_allowance: row.monthly_allowance,
        used_allowance: consumed,
        overage_credits: Math.max(0, consumed - granted - Math.max(0, opening)),
        overage_allowed: (row as { overage_allowed: boolean }).overage_allowed,
        period_end: (row as { current_period_end: string }).current_period_end,
      }
    }

    const { data: invoices } = await supabase
      .from("org_overage_invoices")
      .select("id, period_start, period_end, overage_credits, amount_minor, currency, status")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20)

    return {
      ok: true as const,
      subscription,
      poolBalance,
      plans: SUBSCRIPTION_PLANS.filter((p) => p.active).map((p) => ({
        id: p.id,
        monthlyAllowance: p.monthlyAllowance,
        description: p.description,
      })),
      checkoutConfigured: isSubscriptionCheckoutConfigured(),
      invoices: ((invoices ?? []) as OrgBillingState["invoices"]),
    }
  } catch (e) {
    return toActionFailure(e, "Could not load org billing.") as never
  }
}

export async function startOrgSubscriptionCheckout(input: { orgId: string; planId: string; currency: string }) {
  try {
    const plan = getPlan(input.planId)
    if (!plan || !plan.active) return { ok: false as const, error: "Unknown plan." }
    if (input.currency !== "USD" && input.currency !== "GBP" && input.currency !== "EUR") {
      return { ok: false as const, error: "Unsupported currency." }
    }
    if (!UUID_RE.test(input.orgId)) return { ok: false as const, error: "Invalid organization." }
    if (!isSubscriptionCheckoutConfigured()) {
      return { ok: false as const, error: "Subscriptions aren't open yet." }
    }
    const priceId = planPriceId(plan.id, input.currency as Currency)
    if (!priceId) return { ok: false as const, error: `That plan isn't priced in ${input.currency} yet.` }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Verify your email before subscribing." }
    if (!(await ownerOrg(input.orgId, user.id))) {
      return { ok: false as const, error: "Only the organization owner can subscribe the pool." }
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const svc = createServiceClient(url, key)
    const { data: live } = await svc
      .from("org_subscriptions")
      .select("id")
      .eq("org_id", input.orgId)
      .in("status", ["active", "trialing", "past_due", "paused"])
      .maybeSingle()
    if (live) return { ok: false as const, error: "This pool already has a live plan — cancel it first to switch." }
    return {
      ok: true as const,
      priceId,
      email: user.email ?? "",
      customData: { user_id: user.id, plan_id: plan.id, org_id: input.orgId },
      clientToken: (process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "").trim(),
      environment: (process.env.PADDLE_ENVIRONMENT ?? "").trim().toLowerCase() === "sandbox" ? "sandbox" : "production",
    }
  } catch (e) {
    return toActionFailure(e, "Could not start checkout.") as never
  }
}

export async function cancelOrgSubscription(orgId: string) {
  try {
    if (!UUID_RE.test(orgId)) return { ok: false as const, error: "Invalid organization." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Verify your email first." }
    if (!(await ownerOrg(orgId, user.id))) {
      return { ok: false as const, error: "Only the organization owner can cancel the pool plan." }
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const svc = createServiceClient(url, key)
    const { data: sub } = await svc
      .from("org_subscriptions")
      .select("id, paddle_subscription_id")
      .eq("org_id", orgId)
      .in("status", ["active", "trialing", "past_due", "paused"])
      .maybeSingle()
    const row = sub as { id: string; paddle_subscription_id: string | null } | null
    if (!row) return { ok: false as const, error: "No live pool plan to cancel." }
    if (!row.paddle_subscription_id) return { ok: false as const, error: "Recorded without a provider id — contact support." }
    if (!paddleApiKey()) return { ok: false as const, error: "Billing is not configured." }
    const { Paddle } = await import("@paddle/paddle-node-sdk")
    const paddle = new Paddle(paddleApiKey() as string, { environment: paddleEnvironment() })
    await paddle.subscriptions.cancel(row.paddle_subscription_id, { effectiveFrom: "next_billing_period" })
    return { ok: true as const, endsAtPeriodEnd: true }
  } catch (e) {
    return toActionFailure(e, "Could not cancel. The plan is unchanged.") as never
  }
}

export async function setOrgOverageAllowed(orgId: string, optIn: boolean) {
  try {
    if (!UUID_RE.test(orgId)) return { ok: false as const, error: "Invalid organization." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Verify your email first." }
    if (!(await ownerOrg(orgId, user.id))) {
      return { ok: false as const, error: "Only the organization owner can change overage billing." }
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const svc = createServiceClient(url, key)
    const { error } = await svc
      .from("org_subscriptions")
      .update({ overage_allowed: optIn, updated_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .in("status", ["active", "trialing", "past_due"])
    if (error) throw new Error(error.message)
    try {
      const { createNotification } = await import("@/lib/notifications/store")
      await createNotification(svc, {
        userId: user.id,
        type: "status",
        title: optIn ? "Pool overage billing on" : "Pool overage billing off",
        body: optIn
          ? "The pool meters past allowance and invoices the owner each period."
          : "Hard cap restored on the pool.",
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

export async function settleOrgOverageInvoiceAction(invoiceId: string) {
  try {
    if (!UUID_RE.test(invoiceId)) return { ok: false as const, error: "Invalid invoice." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Verify your email first." }
    const { data: invoice } = await supabase
      .from("org_overage_invoices")
      .select("id, org_id, status")
      .eq("id", invoiceId)
      .maybeSingle()
    const inv = invoice as { id: string; org_id: string; status: string } | null
    if (!inv) return { ok: false as const, error: "Invoice not found." }
    if (!(await ownerOrg(inv.org_id, user.id))) {
      return { ok: false as const, error: "Only the organization owner can pay pool invoices." }
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const svc = createServiceClient(url, key)
    const { settleOrgOverageInvoice } = await import("@/lib/billing/org-subscriptions")
    const res = await settleOrgOverageInvoice(svc, invoiceId)
    return { ok: true as const, ...res }
  } catch (e) {
    return toActionFailure(e, "Payment failed — the invoice is unchanged.") as never
  }
}

export interface OrgPlanChangePreview {
  planId: string
  direction: "upgrade" | "downgrade" | "same"
  mode: string
  dueTodayMinor: number | null
  nextCreditMinor: number | null
  currency: string
}

async function liveOrgSub(svc: SupabaseClient, orgId: string) {
  const { data } = await svc
    .from("org_subscriptions")
    .select("id, plan_id, paddle_subscription_id, currency, status, monthly_allowance, current_period_start, current_period_end")
    .eq("org_id", orgId)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle()
  return (data as {
    id: string; plan_id: string; paddle_subscription_id: string | null; currency: string;
    status: string; monthly_allowance: number; current_period_start: string; current_period_end: string;
  } | null) ?? null
}

/**
 * Org plan changes mirror solo: upgrades bill apportioned now,
 * downgrades credit next invoice, previewed before confirm. Owner-only;
 * the webhook lands plan/period and the true-up grants the prorated
 * pool delta on upgrades.
 */
export async function previewOrgPlanChange(orgId: string, planId: string) {
  try {
    const plan = getPlan(planId)
    if (!plan || !plan.active) return { ok: false as const, error: "Unknown plan." }
    if (!UUID_RE.test(orgId)) return { ok: false as const, error: "Invalid organization." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!(await ownerOrg(orgId, user.id))) {
      return { ok: false as const, error: "Only the organization owner can change the pool plan." }
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const svc = createServiceClient(url, key)
    const row = await liveOrgSub(svc, orgId)
    if (!row) return { ok: false as const, error: "No live pool plan to change." }
    if (!row.paddle_subscription_id) return { ok: false as const, error: "Recorded without a provider id — contact support." }
    if (row.plan_id === planId) return { ok: false as const, error: "That's already the pool plan." }
    if (row.currency !== "USD" && row.currency !== "GBP" && row.currency !== "EUR") {
      return { ok: false as const, error: "Unsupported currency." }
    }
    const priceId = planPriceId(planId, row.currency as Currency)
    if (!priceId) return { ok: false as const, error: `That plan isn't priced in ${row.currency} yet.` }
    const current = getPlan(row.plan_id)
    const direction = !current || plan.monthlyAllowance > current.monthlyAllowance ? "upgrade" : plan.monthlyAllowance < current.monthlyAllowance ? "downgrade" : "same"
    if (direction === "same") return { ok: false as const, error: "Those plans carry the same allowance." }
    const mode = direction === "upgrade" ? "prorated_immediately" : "prorated_next_billing_period"
    if (!paddleApiKey()) return { ok: false as const, error: "Billing is not configured." }
    const { Paddle } = await import("@paddle/paddle-node-sdk")
    const paddle = new Paddle(paddleApiKey() as string, { environment: paddleEnvironment() })
    let dueTodayMinor: number | null = null
    let nextCreditMinor: number | null = null
    try {
      const preview = (await paddle.subscriptions.previewUpdate(row.paddle_subscription_id, {
        items: [{ priceId, quantity: 1 }],
        prorationBillingMode: mode as never,
      })) as unknown as Record<string, unknown>
      const txn = preview.immediate_transaction as { totals?: { total?: string; grand_total?: string } } | undefined
      const totalStr = txn?.totals?.total ?? txn?.totals?.grand_total
      if (typeof totalStr === "string" && /^\d+$/.test(totalStr)) dueTodayMinor = parseInt(totalStr, 10)
      const next = preview.next_transaction as { totals?: { credit?: string } } | undefined
      const creditStr = (next?.totals as { credit?: string } | undefined)?.credit
      if (typeof creditStr === "string" && /^\d+$/.test(creditStr)) nextCreditMinor = parseInt(creditStr, 10)
    } catch {
      // Preview is best-effort; the mode math below still discloses terms.
    }
    const out: OrgPlanChangePreview = { planId, direction, mode, dueTodayMinor, nextCreditMinor, currency: row.currency }
    return { ok: true as const, preview: out }
  } catch (e) {
    return toActionFailure(e, "Could not preview that change.") as never
  }
}

export async function changeOrgPlan(orgId: string, planId: string) {
  try {
    const plan = getPlan(planId)
    if (!plan || !plan.active) return { ok: false as const, error: "Unknown plan." }
    if (!UUID_RE.test(orgId)) return { ok: false as const, error: "Invalid organization." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Verify your email first." }
    if (!(await ownerOrg(orgId, user.id))) {
      return { ok: false as const, error: "Only the organization owner can change the pool plan." }
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const svc = createServiceClient(url, key)
    const row = await liveOrgSub(svc, orgId)
    if (!row) return { ok: false as const, error: "No live pool plan to change." }
    if (!row.paddle_subscription_id) return { ok: false as const, error: "Recorded without a provider id — contact support." }
    if (row.plan_id === planId) return { ok: false as const, error: "That's already the pool plan." }
    if (row.currency !== "USD" && row.currency !== "GBP" && row.currency !== "EUR") {
      return { ok: false as const, error: "Unsupported currency." }
    }
    const priceId = planPriceId(planId, row.currency as Currency)
    if (!priceId) return { ok: false as const, error: `That plan isn't priced in ${row.currency} yet.` }
    const current = getPlan(row.plan_id)
    const isUpgrade = !current || plan.monthlyAllowance > current.monthlyAllowance
    const mode = isUpgrade ? "prorated_immediately" : "prorated_next_billing_period"
    if (!paddleApiKey()) return { ok: false as const, error: "Billing is not configured." }
    const { Paddle } = await import("@paddle/paddle-node-sdk")
    const paddle = new Paddle(paddleApiKey() as string, { environment: paddleEnvironment() })
    await paddle.subscriptions.update(row.paddle_subscription_id, {
      items: [{ priceId, quantity: 1 }],
      prorationBillingMode: mode as never,
    })
    if (isUpgrade) {
      try {
        const start = new Date(row.current_period_start).getTime()
        const end = new Date(row.current_period_end).getTime()
        const span = Math.max(end - start, 86_400_000)
        const left = Math.max(end - Date.now(), 0)
        const delta = Math.floor(((plan.monthlyAllowance - (current?.monthlyAllowance ?? 0)) * left) / span)
        if (delta > 0) {
          const idempotencyKey = `proration:${row.id}:${row.current_period_start.slice(0, 10)}:${planId}`
          const { data: existing } = await svc
            .from("credit_ledger")
            .select("id")
            .eq("org_id", orgId)
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle()
          if (!existing) {
            await svc.from("credit_ledger").insert({
              user_id: user.id,
              org_id: orgId,
              entry_type: "grant",
              amount: delta,
              operation: null,
              status: "finalized",
              idempotency_key: idempotencyKey,
              metadata: { reason: "proration_true_up", planId, subscriptionId: row.id },
            })
          }
        }
      } catch {
        // True-up is best-effort; the plan change stands regardless.
      }
    }
    try {
      const { createNotification } = await import("@/lib/notifications/store")
      await createNotification(svc, {
        userId: user.id,
        type: "status",
        title: isUpgrade ? "Pool plan upgraded" : "Pool plan downgraded",
        body: isUpgrade
          ? "New pool allowance is live now; the apportioned difference bills immediately."
          : "Lower pool allowance applies now; the apportioned credit lands on the next invoice.",
        link: "/settings",
      })
    } catch {
      // Notification is best-effort.
    }
    return { ok: true as const, direction: isUpgrade ? "upgrade" : "downgrade" }
  } catch (e) {
    return toActionFailure(e, "Could not change plan. The pool plan is unchanged.") as never
  }
}
