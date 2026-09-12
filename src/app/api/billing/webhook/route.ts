import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { getPackage, priceForPackage } from "@/lib/billing/catalog"
import { getProviderAdapter, packageIdForVariant } from "@/lib/billing/provider"
import type { Currency } from "@/lib/billing/catalog"
import { reportError } from "@/lib/logger"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get("x-signature") ?? req.headers.get("X-Signature") ?? null

  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  // In test/dev without webhook secret, allow mock adapter to verify with "test" signature
  const adapter = getProviderAdapter()

  let event: {
    type: string
    providerTransactionId: string
    variantId: string
    totalMinor: number
    currency: string
    userId: string
    status: string
    testMode: boolean
  }
  try {
    const verified = await adapter.verifyWebhook({ body, signature, secret: webhookSecret ?? "" })
    event = verified as never
  } catch (e) {
    // Signature failures stay 400s, but repeated probing/misconfiguration
    // must be diagnosable: best-effort warn record, never blocking.
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && key) {
        await reportError(createServiceClient(url, key), {
          phase: "billing_webhook",
          error: "Webhook signature verification failed",
          details: { provider: "lemonsqueezy", step: "verify_signature" },
          severity: "warn",
        })
      }
    } catch {
      // Observability never breaks the rejection path.
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid webhook signature" }, { status: 400 })
  }

  // Refunds (and any subscription events, which Dealenz does not sell) carry
  // no credit policy: record visibly, mutate nothing. Removing previously
  // granted/used credits requires an approved product policy that does not
  // exist yet.
  if (event.status === "refunded" || event.type.startsWith("subscription_")) {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && key) {
        await reportError(createServiceClient(url, key), {
          phase: "billing_webhook",
          error: `Unhandled provider event ${event.type}: no product policy, no credit mutation`,
          details: {
            provider: "lemonsqueezy",
            step: "unhandled_event",
            eventType: String(event.type ?? "unknown").slice(0, 80),
            providerTransactionId: String(event.providerTransactionId ?? "").slice(0, 100),
          },
          severity: "warn",
        })
      }
    } catch {
      // Observability never breaks the acknowledgement path.
    }
    return NextResponse.json({ received: true, status: event.status }, { status: 200 })
  }

  // Only handle succeeded payments; failed/canceled must never grant credits
  if (event.status !== "succeeded") {
    // Still record as failed/canceled for audit if we have a pending row, but do not credit
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceUrl && serviceKey && event.providerTransactionId) {
      try {
        const service = createServiceClient(serviceUrl, serviceKey)
        await service.from("credit_purchases").update({ status: event.status === "canceled" ? "canceled" : "failed" }).eq("provider", "lemonsqueezy").eq("provider_transaction_id", event.providerTransactionId)
      } catch {}
    }
    return NextResponse.json({ received: true, status: event.status }, { status: 200 })
  }

  // Resolve the package from the Lemon Squeezy variant id (server-side map).
  // Checkout custom data is attribution only and never decides entitlement.
  const resolvedPackageId = packageIdForVariant(event.variantId)
  if (!resolvedPackageId) {
    return NextResponse.json({ error: "Unknown variant" }, { status: 400 })
  }
  const pkg = getPackage(resolvedPackageId)
  if (!pkg || !pkg.active) {
    return NextResponse.json({ error: "Unknown or inactive package" }, { status: 400 })
  }

  if (!event.userId) {
    return NextResponse.json({ error: "Missing package or user" }, { status: 400 })
  }

  // Verify amount/currency against the catalog. Totals at or above the
  // catalog price are accepted (provider currency conversion and fees can
  // shift totals upward); anything below is rejected. Mismatches are
  // recorded so dashboard/catalog drift is visible instead of silent.
  const currency = (event.currency as string).toUpperCase() as Currency
  if (currency !== "USD" && currency !== "GBP" && currency !== "EUR") {
    return NextResponse.json({ error: "Unsupported currency" }, { status: 400 })
  }
  const expectedAmount = priceForPackage(pkg, currency)
  if (event.totalMinor < expectedAmount) {
    return NextResponse.json({ error: `Amount below catalog price: expected ${expectedAmount}, got ${event.totalMinor}` }, { status: 400 })
  }

  // Validate user exists (basic UUID format)
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

  // Durable payment-failure records (metadata only: package/currency/ids,
  // never payment secrets). Critical severity fans out to the ops webhook.
  const reportPaymentFailure = (error: unknown, details: Record<string, string | number | boolean | null>) =>
    reportError(service, {
      phase: "billing_webhook",
      error,
      details: { provider: "lemonsqueezy", ...details },
      severity: "critical",
    })

  if (event.totalMinor !== expectedAmount) {
    // Paid more than catalog (conversion/fees): fulfill, but record the
    // drift so pricing can be reconciled in the dashboard.
    await reportError(service, {
      phase: "billing_webhook",
      error: `Paid total differs from catalog: expected ${expectedAmount}, got ${event.totalMinor}`,
      details: { provider: "lemonsqueezy", step: "amount_drift", packageId: pkg.id, currency },
      severity: "warn",
    })
  }

  // Single grant primitive for every path below: idempotent ledger insert
  // keyed on the provider transaction. Concurrent deliveries converge:
  // exactly one insert wins, losers observe the winner's row.
  const ensureLedgerGrant = async (reason: "purchase" | "purchase-repair"): Promise<{ ok: true; duplicate: boolean } | { ok: false; error: string }> => {
    const { error: ledgerErr } = await service.from("credit_ledger").insert({
      user_id: event.userId,
      entry_type: "grant",
      amount: pkg.credits,
      operation: null,
      status: "finalized",
      idempotency_key: `purchase:${event.providerTransactionId}`,
      metadata: { reason, packageId: pkg.id, provider: "lemonsqueezy", providerTransactionId: event.providerTransactionId, currency, amountMinor: event.totalMinor },
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

  // Idempotency: check if this provider transaction already succeeded
  const { data: existing } = await service.from("credit_purchases").select("id, status").eq("provider", "lemonsqueezy").eq("provider_transaction_id", event.providerTransactionId).maybeSingle()
  if (existing) {
    const row = existing as { status: string }
    if (row.status === "succeeded") {
      // Verify the grant actually landed: a previous attempt may have marked
      // the purchase succeeded while the ledger insert failed. Repair instead
      // of silently dropping a paid entitlement.
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
    // If pending/failed, we will update to succeeded below
  }

  // Upsert purchase record as succeeded (or insert if not exists)
  if (existing) {
    const { error: updErr } = await service
      .from("credit_purchases")
      .update({ status: "succeeded", user_id: event.userId, package_id: pkg.id, currency, amount_minor: event.totalMinor, credits: pkg.credits })
      .eq("provider", "lemonsqueezy")
      .eq("provider_transaction_id", event.providerTransactionId)
    if (updErr) {
      await reportPaymentFailure(updErr, { step: "purchase_upsert", packageId: pkg.id, currency })
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
  } else {
    const { error: insErr } = await service.from("credit_purchases").insert({
      user_id: event.userId,
      provider: "lemonsqueezy",
      provider_transaction_id: event.providerTransactionId,
      package_id: pkg.id,
      currency,
      amount_minor: event.totalMinor,
      credits: pkg.credits,
      status: "succeeded",
    })
    if (insErr) {
      // Unique violation means a concurrent delivery inserted first: run the
      // same grant verification instead of assuming fulfillment, so one
      // delivery wave converges without needing another provider retry.
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

  // Allocate credits via existing ledger — use service role direct insert (bypasses RLS, no admin check)
  // Idempotency for ledger: use provider_transaction_id as idempotency_key
  const granted = await ensureLedgerGrant("purchase")
  if (!granted.ok) {
    // Ledger failure after purchase record succeeded — log but do not double-credit on retry; purchase is already succeeded
    await reportPaymentFailure(granted.error, { step: "ledger_grant", packageId: pkg.id, currency, credits: pkg.credits })
    return NextResponse.json({ error: granted.error }, { status: 500 })
  }

  return NextResponse.json({ received: true, credits: pkg.credits }, { status: 200 })
}
