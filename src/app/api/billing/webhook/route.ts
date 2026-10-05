import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { getPackage, priceForPackage } from "@/lib/billing/catalog"
import { getProviderAdapter, isPaddleConfigured, packageIdForPrice } from "@/lib/billing/provider"
import type { Currency } from "@/lib/billing/catalog"
import { reportError } from "@/lib/logger"

export async function POST(req: NextRequest) {
  // Fail closed when the provider is unconfigured — in ANY environment. The
  // mock adapter exists for unit tests only; serving it here would mint
  // credits from unsigned bodies on misconfigured deploys (including
  // previews, where NODE_ENV is production but Vercel env metadata differs).
  if (!isPaddleConfigured()) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 })
  }
  const body = await req.text()
  const signature = req.headers.get("paddle-signature") ?? req.headers.get("Paddle-Signature") ?? null

  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET
  const adapter = getProviderAdapter()

  // Branch on the event name before verifying: transactions and
  // subscriptions ride separate parsers (the transaction parser keeps
  // rejecting subscription events — covered by tests). Peeking at the
  // name trusts nothing; both branches verify the signature internally.
  let isSubscription = false
  try {
    const peek = JSON.parse(body) as { event_type?: unknown }
    isSubscription = typeof peek.event_type === "string" && peek.event_type.startsWith("subscription.")
  } catch {
    return NextResponse.json({ error: "Invalid webhook body" }, { status: 400 })
  }

  if (isSubscription) {
    return handleSubscriptionEvent(body, signature, webhookSecret, adapter)
  }
  let event: {
    type: string
    providerTransactionId: string
    priceId: string
    totalMinor: number
    currency: string
    userId: string
    status: string
  }
  let verifiedRaw: unknown = null
  try {
    const verified = await adapter.verifyWebhook({ body, signature, secret: webhookSecret ?? "" })
    event = verified as never
    verifiedRaw = (verified as unknown as { raw?: unknown }).raw ?? null
  } catch (e) {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && key) {
        await reportError(createServiceClient(url, key), {
          phase: "billing_webhook",
          error: "Webhook signature verification failed",
          details: { provider: "paddle", step: "verify_signature" },
          severity: "warn",
        })
      }
    } catch {
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid webhook signature" }, { status: 400 })
  }

  // Overage settlement: a transaction carrying custom_data.overage_invoice_id
  // pays a period invoice — mark paid, grant NOTHING (the work already ran).
  // Branched before pack pricing (overage prices are unknown to packs).
  // Solo and org invoices share the custom-data key; the id is looked up
  // in both tables, org match verified the same way.
  {
    const raw = verifiedRaw as {
      data?: { custom_data?: { overage_invoice_id?: unknown; user_id?: unknown; org_id?: unknown } }
    } | null
    const custom = raw?.data?.custom_data
    const overageInvoiceId = typeof custom?.overage_invoice_id === "string" ? custom.overage_invoice_id : ""
    if (overageInvoiceId !== "") {
      const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!serviceUrl || !serviceKey) {
        return NextResponse.json({ error: "Service role not configured" }, { status: 503 })
      }
      try {
        const service = createServiceClient(serviceUrl, serviceKey)
        const { data: invoice } = await service
          .from("overage_invoices")
          .select("id, user_id, status")
          .eq("id", overageInvoiceId)
          .maybeSingle()
        const inv = invoice as { id: string; user_id: string; status: string } | null
        if (inv) {
          if (typeof custom?.user_id === "string" && custom.user_id !== inv.user_id) {
            return NextResponse.json({ error: "Invoice user mismatch" }, { status: 400 })
          }
          if (inv.status === "paid") return NextResponse.json({ received: true, idempotent: true }, { status: 200 })
          await service
            .from("overage_invoices")
            .update({ status: "paid", paddle_transaction_id: event.providerTransactionId })
            .eq("id", inv.id)
            .in("status", ["pending", "invoiced"])
          return NextResponse.json({ received: true, overage_paid: true }, { status: 200 })
        }
        const { data: orgInvoice } = await service
          .from("org_overage_invoices")
          .select("id, org_id, payer_user_id, status")
          .eq("id", overageInvoiceId)
          .maybeSingle()
        const orgInv = orgInvoice as { id: string; org_id: string; payer_user_id: string; status: string } | null
        if (!orgInv) return NextResponse.json({ error: "Unknown overage invoice" }, { status: 400 })
        if (typeof custom?.org_id === "string" && custom.org_id !== orgInv.org_id) {
          return NextResponse.json({ error: "Invoice org mismatch" }, { status: 400 })
        }
        if (typeof custom?.user_id === "string" && custom.user_id !== orgInv.payer_user_id) {
          return NextResponse.json({ error: "Invoice payer mismatch" }, { status: 400 })
        }
        if (orgInv.status === "paid") return NextResponse.json({ received: true, idempotent: true }, { status: 200 })
        await service
          .from("org_overage_invoices")
          .update({ status: "paid", paddle_transaction_id: event.providerTransactionId })
          .eq("id", orgInv.id)
          .in("status", ["pending", "invoiced"])
        return NextResponse.json({ received: true, overage_paid: true }, { status: 200 })
      } catch {
        return NextResponse.json({ error: "Overage settlement failed" }, { status: 500 })
      }
    }
  }

  // Refunds and disputes: money returned means credits return too. Support
  // refunds in the Paddle dashboard after verifying the pack is unused; this
  // branch then revokes exactly what that purchase granted (from the purchase
  // row, never the live catalog, which may have repriced since). Disputes
  // and chargebacks revoke through the same path: one revocation per
  // transaction (shared idempotency key), never double. Idempotent on
  // `refund:<txn>` plus the terminal-status guard, so Paddle replays are
  // safe. A negative balance simply blocks future reservations until the
  // account is topped up again.
  if (event.status === "refunded" || event.status === "disputed") {
    const terminalStatus = event.status === "disputed" ? "disputed" : "refunded"
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    // Fail closed like the succeeded path: a 200 here tells Paddle the refund
    // was processed and stops retries while the user keeps the credits.
    if (!serviceUrl || !serviceKey) {
      return NextResponse.json({ error: "Service role not configured" }, { status: 503 })
    }
    if (serviceUrl && serviceKey && event.providerTransactionId) {
      try {
        const service = createServiceClient(serviceUrl, serviceKey)
        const { data: purchase } = await service
          .from("credit_purchases")
          .select("id, user_id, org_id, package_id, credits, status")
          .eq("provider", "paddle")
          .eq("provider_transaction_id", event.providerTransactionId)
          .maybeSingle()
        const row = purchase as { id: string; user_id: string; org_id: string | null; package_id: string; credits: number; status: string } | null
        if (row && (row.status === "refunded" || row.status === "disputed")) {
          return NextResponse.json({ received: true, idempotent: true }, { status: 200 })
        }
        if (row && typeof row.credits === "number" && row.credits > 0) {
          const { error: revokeError } = await service.from("credit_ledger").insert({
            user_id: row.user_id,
            org_id: row.org_id,
            entry_type: "adjustment",
            amount: -Math.floor(row.credits),
            operation: null,
            status: "finalized",
            idempotency_key: `refund:${event.providerTransactionId}`,
            metadata: { reason: event.status === "disputed" ? "purchase_dispute" : "purchase_refund", packageId: row.package_id, provider: "paddle", providerTransactionId: event.providerTransactionId },
          })
          if (revokeError && !revokeError.message.toLowerCase().includes("duplicate") && !revokeError.message.toLowerCase().includes("unique")) {
            return NextResponse.json({ error: "Refund revocation failed" }, { status: 500 })
          }
          await service.from("credit_purchases").update({ status: terminalStatus }).eq("id", row.id)
          return NextResponse.json({ received: true, refunded: true }, { status: 200 })
        }
      } catch {
        return NextResponse.json({ error: "Refund revocation failed" }, { status: 500 })
      }
    }
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && key) {
        await reportError(createServiceClient(url, key), {
          phase: "billing_webhook",
          error: `Unhandled provider event ${event.type}: no product policy, no credit mutation`,
          details: {
            provider: "paddle",
            step: "unhandled_event",
            eventType: String(event.type ?? "unknown").slice(0, 80),
            providerTransactionId: String(event.providerTransactionId ?? "").slice(0, 100),
          },
          severity: "warn",
        })
      }
    } catch {
    }
    return NextResponse.json({ received: true, status: event.status }, { status: 200 })
  }

  // Subscription lifecycle: upsert the subscription row and drop the
  // opening allowance on first activation. Unknown prices, missing user
  // attribution, and unconfigured service role all fail closed (4xx/5xx
  // so Paddle retries a decision that may resolve; successes ack 200).
  async function handleSubscriptionEvent(
    rawBody: string,
    sig: string | null,
    secret: string | undefined,
    provider: ReturnType<typeof getProviderAdapter>
  ) {
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceUrl || !serviceKey) {
      return NextResponse.json({ error: "Service role not configured" }, { status: 503 })
    }
    let verified: {
      type: string
      subscriptionId: string
      status: string
      priceId: string
      userId: string
      orgId: string | null
      periodStart: string | null
      periodEnd: string | null
    }
    try {
      verified = await provider.verifySubscriptionWebhook({ body: rawBody, signature: sig, secret: secret ?? "" })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid webhook signature" }, { status: 400 })
    }
    // Org plans branch before solo: attribution carries org_id, and the
    // payer must own the org (enforced in the apply path).
    if (typeof verified.orgId === "string" && verified.orgId !== "") {
      try {
        const service = createServiceClient(serviceUrl, serviceKey)
        const { applyOrgSubscriptionEvent } = await import("@/lib/billing/org-subscriptions")
        const applied = await applyOrgSubscriptionEvent(service, {
          type: verified.type,
          subscriptionId: verified.subscriptionId,
          status: verified.status,
          priceId: verified.priceId,
          userId: verified.userId,
          orgId: verified.orgId,
          periodStart: verified.periodStart,
          periodEnd: verified.periodEnd,
        })
        try {
          const { createNotification } = await import("@/lib/notifications/store")
          const { data: orgSub } = await service.from("org_subscriptions").select("owner_user_id").eq("id", applied.subscriptionId).maybeSingle()
          const ownerId = (orgSub as { owner_user_id?: string } | null)?.owner_user_id
          if (ownerId) {
            await createNotification(service, {
              userId: ownerId,
              type: "status",
              title: applied.status === "canceled" ? "Pool plan canceled" : "Pool plan active",
              body: applied.status === "canceled"
                ? "The pool plan is canceled — the pool keeps its packs, allowance stops renewing."
                : `The pool plan is live${applied.granted ? " and this period's allowance is in the pool" : ""}.`,
              link: "/settings",
            })
          }
        } catch {
          // The subscription stands regardless; the notification is best-effort.
        }
        return NextResponse.json({ received: true, subscription: applied.subscriptionId, status: applied.status }, { status: 200 })
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Subscription event failed" }, { status: 400 })
      }
    }
    try {
      const service = createServiceClient(serviceUrl, serviceKey)
      const { applySubscriptionEvent } = await import("@/lib/billing/subscriptions")
      const applied = await applySubscriptionEvent(service, {
        type: verified.type,
        subscriptionId: verified.subscriptionId,
        status: verified.status,
        priceId: verified.priceId,
        userId: verified.userId,
        orgId: verified.orgId,
        periodStart: verified.periodStart,
        periodEnd: verified.periodEnd,
        raw: null,
      })
      try {
        const { createNotification } = await import("@/lib/notifications/store")
        const { data: owner } = await service.from("subscriptions").select("user_id, plan_id").eq("id", applied.subscriptionId).maybeSingle()
        const ownerId = (owner as { user_id?: string; plan_id?: string } | null)?.user_id
        if (ownerId) {
          await createNotification(service, {
            userId: ownerId,
            type: "status",
            title: applied.status === "canceled" ? "Subscription canceled" : "Subscription active",
            body: applied.status === "canceled"
              ? "Your subscription is canceled — packs keep working anytime."
              : `Your plan is live${applied.granted ? " and this period's allowance is in your balance" : ""}.`,
            link: "/settings",
          })
        }
      } catch {
        // The subscription stands regardless; the notification is best-effort.
      }
      return NextResponse.json({ received: true, subscription: applied.subscriptionId, status: applied.status }, { status: 200 })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Subscription event failed" }, { status: 400 })
    }
  }

  if (event.status !== "succeeded") {
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceUrl && serviceKey && event.providerTransactionId) {
      try {
        const service = createServiceClient(serviceUrl, serviceKey)
        await service.from("credit_purchases").update({ status: event.status === "canceled" ? "canceled" : "failed" }).eq("provider", "paddle").eq("provider_transaction_id", event.providerTransactionId)
      } catch {}
    }
    return NextResponse.json({ received: true, status: event.status }, { status: 200 })
  }

  const resolvedPackageId = packageIdForPrice(event.priceId)
  if (!resolvedPackageId) {
    return NextResponse.json({ error: "Unknown price" }, { status: 400 })
  }
  const pkg = getPackage(resolvedPackageId)
  if (!pkg || !pkg.active) {
    return NextResponse.json({ error: "Unknown or inactive package" }, { status: 400 })
  }

  if (!event.userId) {
    return NextResponse.json({ error: "Missing package or user" }, { status: 400 })
  }

  const currency = (event.currency as string).toUpperCase() as Currency
  if (currency !== "USD" && currency !== "GBP" && currency !== "EUR") {
    return NextResponse.json({ error: "Unsupported currency" }, { status: 400 })
  }
  const expectedAmount = priceForPackage(pkg, currency)
  if (event.totalMinor < expectedAmount) {
    // Money arrived but short of catalog: a 4xx tells Paddle to retry a
    // decision that can never change. Ack without granting and escalate for
    // human follow-up instead — the payment is real, the fulfillment isn't.
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && key) {
        await reportError(createServiceClient(url, key), {
          phase: "billing_webhook",
          error: `Paid total below catalog: expected ${expectedAmount}, got ${event.totalMinor}`,
          details: { provider: "paddle", step: "underpayment", packageId: pkg.id, currency, providerTransactionId: event.providerTransactionId },
          severity: "critical",
        })
      }
    } catch {
      // Reporting never breaks the ack.
    }
    return NextResponse.json({ received: true, status: "underpaid" }, { status: 200 })
  }

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRe.test(event.userId)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 })
  }

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceUrl || !serviceKey) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 500 })
  }

  const service = createServiceClient(serviceUrl, serviceKey)

  // Pool funding: checkout stamps custom_data.org_id; the grant lands on
  // the pool with the purchaser as actor. Only owners/admins may fund.
  let poolOrgId: string | null = null
  {
    const raw = verifiedRaw as {
      data?: { custom_data?: { org_id?: unknown } }
    } | null
    const orgRaw = raw?.data?.custom_data?.org_id
    if (typeof orgRaw === "string" && uuidRe.test(orgRaw)) {
      const { data: role } = await service
        .from("organization_members")
        .select("role")
        .eq("org_id", orgRaw)
        .eq("user_id", event.userId)
        .maybeSingle()
      const r = (role as { role?: string } | null)?.role
      if (r !== "owner" && r !== "admin") {
        return NextResponse.json({ error: "Only organization owners and admins can fund the pool." }, { status: 400 })
      }
      poolOrgId = orgRaw
    } else if (orgRaw !== undefined && orgRaw !== null) {
      return NextResponse.json({ error: "Invalid pool attribution." }, { status: 400 })
    }
  }

  const reportPaymentFailure = (error: unknown, details: Record<string, string | number | boolean | null>) =>
    reportError(service, {
      phase: "billing_webhook",
      error,
      details: { provider: "paddle", ...details },
      severity: "critical",
    })

  if (event.totalMinor !== expectedAmount) {
    await reportError(service, {
      phase: "billing_webhook",
      error: `Paid total differs from catalog: expected ${expectedAmount}, got ${event.totalMinor}`,
      details: { provider: "paddle", step: "amount_drift", packageId: pkg.id, currency },
      severity: "warn",
    })
  }

  const ensureLedgerGrant = async (reason: "purchase" | "purchase-repair"): Promise<{ ok: true; duplicate: boolean } | { ok: false; error: string }> => {
    const { error: ledgerErr } = await service.from("credit_ledger").insert({
      user_id: event.userId,
      org_id: poolOrgId,
      entry_type: "grant",
      amount: pkg.credits,
      operation: null,
      status: "finalized",
      idempotency_key: `purchase:${event.providerTransactionId}`,
      metadata: { reason, packageId: pkg.id, provider: "paddle", providerTransactionId: event.providerTransactionId, currency, amountMinor: event.totalMinor },
    })
    if (!ledgerErr) return { ok: true, duplicate: false }
    if (ledgerErr.message.toLowerCase().includes("duplicate") || ledgerErr.message.toLowerCase().includes("unique")) {
      return { ok: true, duplicate: true }
    }
    return { ok: false, error: ledgerErr.message }
  }
  const grantExists = async (): Promise<boolean> => {
    const { data: grant } = await service
      .from("credit_ledger")
      .select("id")
      .eq("user_id", event.userId)
      .eq("idempotency_key", `purchase:${event.providerTransactionId}`)
      .maybeSingle()
    return grant != null
  }

  const { data: existing } = await service.from("credit_purchases").select("id, status").eq("provider", "paddle").eq("provider_transaction_id", event.providerTransactionId).maybeSingle()
  if (existing) {
    const row = existing as { status: string }
    if (row.status === "succeeded") {
      if (await grantExists()) {
        return NextResponse.json({ received: true, idempotent: true }, { status: 200 })
      }
      const repaired = await ensureLedgerGrant("purchase-repair")
      if (!repaired.ok) {
        await reportPaymentFailure(repaired.error, { step: "ledger_repair", packageId: pkg.id, currency })
        return NextResponse.json({ error: repaired.error }, { status: 500 })
      }
      return NextResponse.json({ received: true, repaired: true }, { status: 200 })
    }
  }

  if (existing) {
    const { error: updErr } = await service
      .from("credit_purchases")
      .update({ status: "succeeded", user_id: event.userId, org_id: poolOrgId, package_id: pkg.id, currency, amount_minor: event.totalMinor, credits: pkg.credits })
      .eq("provider", "paddle")
      .eq("provider_transaction_id", event.providerTransactionId)
    if (updErr) {
      await reportPaymentFailure(updErr, { step: "purchase_upsert", packageId: pkg.id, currency })
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
  } else {
    const { error: insErr } = await service.from("credit_purchases").insert({
      user_id: event.userId,
      org_id: poolOrgId,
      provider: "paddle",
      provider_transaction_id: event.providerTransactionId,
      package_id: pkg.id,
      currency,
      amount_minor: event.totalMinor,
      credits: pkg.credits,
      status: "succeeded",
    })
    if (insErr) {
      if (insErr.message.toLowerCase().includes("duplicate") || insErr.message.toLowerCase().includes("unique")) {
        if (await grantExists()) {
          return NextResponse.json({ received: true, idempotent: true }, { status: 200 })
        }
        const repaired = await ensureLedgerGrant("purchase-repair")
        if (!repaired.ok) {
          await reportPaymentFailure(repaired.error, { step: "ledger_repair_race", packageId: pkg.id, currency })
          return NextResponse.json({ error: repaired.error }, { status: 500 })
        }
        return NextResponse.json({ received: true, repaired: true }, { status: 200 })
      }
      await reportPaymentFailure(insErr, { step: "purchase_insert", packageId: pkg.id, currency })
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  const granted = await ensureLedgerGrant("purchase")
  if (!granted.ok) {
    await reportPaymentFailure(granted.error, { step: "ledger_grant", packageId: pkg.id, currency, credits: pkg.credits })
    return NextResponse.json({ error: granted.error }, { status: 500 })
  }

  return NextResponse.json({ received: true, credits: pkg.credits }, { status: 200 })
}
