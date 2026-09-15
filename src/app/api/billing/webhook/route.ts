import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { getPackage, priceForPackage } from "@/lib/billing/catalog"
import { getProviderAdapter, packageIdForPrice } from "@/lib/billing/provider"
import type { Currency } from "@/lib/billing/catalog"
import { reportError } from "@/lib/logger"

export async function POST(req: NextRequest) {
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

  if (event.status === "refunded" || event.type.startsWith("subscription_")) {
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
