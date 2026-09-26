import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { validatePurchaseInput, priceForPackage } from "@/lib/billing/catalog"
import { getProviderAdapter, isPaddleConfigured, priceIdForPackage } from "@/lib/billing/provider"
import { checkRateLimit } from "@/lib/rate-limit"
import { reportError } from "@/lib/logger"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: "Please verify your email address" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const input = body as Record<string, unknown>
  const validated = validatePurchaseInput({ packageId: input.packageId, currency: input.currency })
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }
  const { package: pkg, currency } = validated
  const amountMinor = priceForPackage(pkg, currency)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL is not configured" }, { status: 500 })
  }
  // Safe URL derivation — never trust client-provided URLs
  let successUrl: string
  let cancelUrl: string
  try {
    const base = new URL(appUrl)
    successUrl = new URL("/billing?checkout=success", base).toString()
    cancelUrl = new URL("/billing?checkout=cancel", base).toString()
  } catch {
    return NextResponse.json({ error: "Invalid NEXT_PUBLIC_APP_URL" }, { status: 500 })
  }

  // Fail closed whenever the provider is unconfigured — in ANY environment.
  // The old VERCEL_ENV === "production" check left previews (where NODE_ENV
  // is production) serving mock checkout sessions. Local development without
  // keys gets the same honest 503; unit tests exercise the mock adapter
  // directly, never this route.
  if (!isPaddleConfigured()) {
    return NextResponse.json({ error: "Credit purchases are not available right now. Please try again later." }, { status: 503 })
  }

  // Currency-scoped availability: Paddle prices are single-currency, so a
  // buyer currency with no price id must fail here with a clear message —
  // never charge a USD price while the UI shows £/€ amounts.
  if (!priceIdForPackage(pkg.id, currency)) {
    return NextResponse.json({ error: `The ${pkg.id} package is not available in ${currency} yet — switch to USD or try again later.` }, { status: 400 })
  }

  // Abuse bound: checkout sessions cost provider API calls and each click
  // mints a pending purchase row. Authenticated users only, 10/day.
  const rate = await checkRateLimit("createCheckout")
  if (!rate.allowed) {
    return NextResponse.json({ error: rate.error ?? "Rate limit exceeded" }, { status: 429 })
  }

  // Create pending purchase record via service role for idempotency (server-authoritative)
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  let checkoutId: string | null = null

  const adapter = getProviderAdapter()
  let session: { id: string; url: string }
  try {
    session = await adapter.createCheckoutSession({
      package: pkg,
      currency,
      amountMinor,
      userId: user.id,
      userEmail: user.email ?? null,
      successUrl,
      cancelUrl,
    })
    checkoutId = session.id
  } catch (e) {
    // Never surface provider internals (invalid keys, price ids, API
    // outages) to buyers: log server-side, show the same honest generic the
    // client already renders for every other checkout failure.
    try {
      const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceUrl && serviceKey) {
        await reportError(createServiceClient(serviceUrl, serviceKey), {
          phase: "billing_checkout",
          error: e instanceof Error ? e.message : "Failed to create checkout",
          details: { provider: "paddle", packageId: pkg.id, currency },
          severity: "critical",
        })
      }
    } catch {
      // Reporting must never break the error response itself.
    }
    return NextResponse.json({ error: "Checkout is not available right now" }, { status: 500 })
  }

  // Record pending purchase for webhook correlation (service role, bypass RLS)
  if (serviceUrl && serviceKey && checkoutId) {
    try {
      const service = createServiceClient(serviceUrl, serviceKey)
      await service.from("credit_purchases").insert({
        user_id: user.id,
        provider: "paddle",
        provider_transaction_id: checkoutId,
        package_id: pkg.id,
        currency,
        amount_minor: amountMinor,
        credits: pkg.credits,
        status: "pending",
      })
    } catch {
      // Pending record failure should not block checkout URL return; webhook will still handle
    }
  }

  return NextResponse.json({ url: session.url, checkoutId: session.id })
}
