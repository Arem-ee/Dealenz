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

  let event: {
    type: string
    providerTransactionId: string
    priceId: string
    totalMinor: number
    currency: string
    userId: string
    status: string
  }
  try {
    const verified = await adapter.verifyWebhook({ body, signature, secret: webhookSecret ?? "" })
    event = verified as never
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
    if (serviceUrl && serviceKey && event.providerTransactionId) {
      try {
        const service = createServiceClient(serviceUrl, serviceKey)
        const { data: purchase } = await service
          .from("credit_purchases")
          .select("id, user_id, package_id, credits, status")
          .eq("provider", "paddle")
          .eq("provider_transaction_id", event.providerTransactionId)
          .maybeSingle()
        const row = purchase as { id: string; user_id: string; package_id: string; credits: number; status: string } | null
        if (row && (row.status === "refunded" || row.status === "disputed")) {
          return NextResponse.json({ received: true, idempotent: true }, { status: 200 })
        }
        if (row && typeof row.credits === "number" && row.credits > 0) {
          const { error: revokeError } = await service.from("credit_ledger").insert({
            user_id: row.user_id,
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

  // Dealenz sells one-time packs only: subscription events have no product
  // meaning. Acknowledge without mutating anything (previous behavior).
  if (event.type.startsWith("subscription_")) {
    return NextResponse.json({ received: true, status: event.status }, { status: 200 })
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
    return NextResponse.json({ error: `Amount below catalog price: expected ${expectedAmount}, got ${event.totalMinor}` }, { status: 400 })
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
      .update({ status: "succeeded", user_id: event.userId, package_id: pkg.id, currency, amount_minor: event.totalMinor, credits: pkg.credits })
      .eq("provider", "paddle")
      .eq("provider_transaction_id", event.providerTransactionId)
    if (updErr) {
      await reportPaymentFailure(updErr, { step: "purchase_upsert", packageId: pkg.id, currency })
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
  } else {
    const { error: insErr } = await service.from("credit_purchases").insert({
      user_id: event.userId,
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
