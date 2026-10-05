import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createHmac } from "node:crypto"
import {
  createMockAdapter,
  createPaddleAdapter,
  enabledCurrencies,
  isSubscriptionCheckoutConfigured,
  overagePriceId,
  parsePaddleSubscriptionEvent,
  parsePaddleTransactionEvent,
  planPriceId,
  priceIdForPackage,
  packageIdForPrice,
  isPaddleConfigured,
  verifyPaddleSignature,
} from "./provider"
import { getPackage, getPlan, planAndCurrencyForPrice } from "./catalog"

const OLD_ENV = { ...process.env }

function setPaddleEnv() {
  process.env.PADDLE_API_KEY = "pdl_live_apikey_test"
  process.env.PADDLE_WEBHOOK_SECRET = "pdl_ntfset_test_secret_1234567890abcdef"
  process.env.PADDLE_PRICE_STARTER = "pri_starter_111"
  process.env.PADDLE_PRICE_STANDARD = "pri_standard_222"
  process.env.PADDLE_PRICE_PRO = "pri_pro_333"
  process.env.PADDLE_ENVIRONMENT = "sandbox"
  process.env.PADDLE_PLAN_STUDIO = "pri_studio_usd"
  process.env.PADDLE_PLAN_FIRM = "pri_firm_usd"
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "test_client_token"
}

beforeEach(() => {
  setPaddleEnv()
})

afterEach(() => {
  process.env = { ...OLD_ENV }
})

function paddleBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    event_id: "evt_01test",
    event_type: "transaction.completed",
    occurred_at: new Date().toISOString(),
    notification_id: "ntf_01test",
    data: {
      id: "txn_01test12345678901234567890ab",
      status: "completed",
      customer_id: "ctm_01test",
      currency_code: "USD",
      custom_data: { user_id: "00000000-0000-0000-0000-000000000001", package_id: "standard" },
      items: [{ price: { id: "pri_standard_222" }, quantity: 1 }],
      details: { totals: { total: "4900", currency_code: "USD" } },
      ...((overrides.data as Record<string, unknown>) ?? {}),
    },
    ...overrides,
  })
}

function paddleSig(body: string, secret: string): string {
  const ts = Math.floor(Date.now() / 1000).toString()
  const signed = `${ts}:${body}`
  const h1 = createHmac("sha256", secret).update(signed, "utf8").digest("hex")
  return `ts=${ts};h1=${h1}`
}

describe("billing provider adapter — Paddle", () => {
  it("reports Paddle configuration presence honestly", () => {
    expect(isPaddleConfigured()).toBe(true)
    expect(priceIdForPackage("standard")).toBe("pri_standard_222")
    expect(packageIdForPrice("pri_standard_222")).toBe("standard")
    expect(packageIdForPrice("pri_unknown")).toBeNull()
    delete process.env.PADDLE_PRICE_PRO
    expect(isPaddleConfigured()).toBe(false)
  })

  it("resolves prices per buyer currency and never falls back across currencies", () => {
    // Legacy bare variables are USD-denominated: USD resolves, GBP does not.
    expect(priceIdForPackage("standard", "USD")).toBe("pri_standard_222")
    expect(priceIdForPackage("standard", "GBP")).toBeNull()
    process.env.PADDLE_PRICE_STANDARD_GBP = "pri_standard_gbp"
    expect(priceIdForPackage("standard", "GBP")).toBe("pri_standard_gbp")
    expect(packageIdForPrice("pri_standard_gbp")).toBe("standard")
    // A GBP buyer is offered nothing until every package has a GBP price.
    expect(enabledCurrencies(["starter", "standard", "pro"])).toEqual(["USD"])
    process.env.PADDLE_PRICE_STARTER_GBP = "pri_starter_gbp"
    process.env.PADDLE_PRICE_PRO_GBP = "pri_pro_gbp"
    expect(enabledCurrencies(["starter", "standard", "pro"])).toEqual(["USD", "GBP"])
  })

  it("accepts any presented h1 during secret rotation", () => {
    const body = paddleBody()
    const secret = "pdl_ntfset_test_secret_1234567890abcdef"
    const ts = Math.floor(Date.now() / 1000).toString()
    const good = createHmac("sha256", secret).update(`${ts}:${body}`, "utf8").digest("hex")
    const stale = createHmac("sha256", "old-secret").update(`${ts}:${body}`, "utf8").digest("hex")
    // Valid signature first or second — both genuine rotation shapes pass.
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${good};h1=${stale}`, secret)).toBe(true)
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${stale};h1=${good}`, secret)).toBe(true)
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${stale}`, secret)).toBe(false)
  })

  it("verifies Paddle HMAC signatures and rejects tampering", async () => {
    const adapter = createPaddleAdapter()
    const body = paddleBody()
    const sig = paddleSig(body, "pdl_ntfset_test_secret_1234567890abcdef")
    const verified = await adapter.verifyWebhook({ body, signature: sig, secret: "pdl_ntfset_test_secret_1234567890abcdef" })
    expect(verified.providerTransactionId).toBe("txn_01test12345678901234567890ab")
    expect(verified.priceId).toBe("pri_standard_222")
    expect(verified.status).toBe("succeeded")
    await expect(adapter.verifyWebhook({ body: body + " ", signature: sig, secret: "pdl_ntfset_test_secret_1234567890abcdef" })).rejects.toThrow(/signature/i)
    await expect(adapter.verifyWebhook({ body, signature: "ts=1;h1=0".repeat(32), secret: "pdl_ntfset_test_secret_1234567890abcdef" })).rejects.toThrow(/signature/i)
  })

  it("rejects old replayed signatures via timestamp tolerance", () => {
    const body = paddleBody()
    const oldTs = (Math.floor(Date.now() / 1000) - 600).toString()
    const h1 = createHmac("sha256", "pdl_ntfset_test_secret_1234567890abcdef").update(`${oldTs}:${body}`, "utf8").digest("hex")
    const oldSig = `ts=${oldTs};h1=${h1}`
    expect(verifyPaddleSignature(body, oldSig, "pdl_ntfset_test_secret_1234567890abcdef")).toBe(false)
  })

  it("rejects malformed Paddle-Signature header", () => {
    const body = paddleBody()
    expect(verifyPaddleSignature(body, "not-a-valid-header", "secret")).toBe(false)
    expect(verifyPaddleSignature(body, null, "secret")).toBe(false)
    expect(verifyPaddleSignature(body, "ts=123", "secret")).toBe(false)
  })

  it("rejects events missing transaction or price ids", () => {
    const noId = JSON.parse(paddleBody()) as Record<string, unknown>
    ;((noId.data as Record<string, unknown>).id as unknown) = null
    expect(() => parsePaddleTransactionEvent(noId)).toThrow(/transaction id/)
    const noPrice = JSON.parse(paddleBody()) as Record<string, unknown>
    ;((noPrice.data as Record<string, unknown>).items as unknown[]) = [{ price: {} }]
    expect(() => parsePaddleTransactionEvent(noPrice)).toThrow(/price id/)
  })

  it("rejects unsupported event types and non-completed statuses", () => {
    expect(() => parsePaddleTransactionEvent(JSON.parse(paddleBody({ event_type: "subscription.created" })))).toThrow(/unsupported/i)
    const draft = JSON.parse(paddleBody()) as Record<string, unknown>
    ;(draft.data as Record<string, unknown>).status = "draft"
    expect(() => parsePaddleTransactionEvent(draft)).toThrow(/not in a fulfillable state/)
  })

  it("maps provider refunds to the refunded status", () => {
    const refunded = JSON.parse(
      paddleBody({ event_type: "transaction.updated" })
    ) as Record<string, unknown>
    ;(refunded.data as Record<string, unknown>).status = "refunded"
    const event = parsePaddleTransactionEvent(refunded)
    expect(event.status).toBe("refunded")
    expect(event.providerTransactionId).toMatch(/^txn_/)
  })

  it("mock adapter stays Paddle-shaped and deterministic", async () => {
    const adapter = createMockAdapter()
    const pkg = getPackage("starter")!
    const session = await adapter.createCheckoutSession({
      package: pkg,
      currency: "USD",
      amountMinor: pkg.prices.USD,
      userId: "00000000-0000-0000-0000-000000000001",
      userEmail: "test@example.com",
      successUrl: "https://example.com/billing?checkout=success",
      cancelUrl: "https://example.com/billing?checkout=cancel",
    })
    expect(session.provider).toBe("paddle")
    expect(session.url).toContain("paddle")
  })

  it("fails closed without Paddle configuration", async () => {
    delete process.env.PADDLE_API_KEY
    const adapter = createPaddleAdapter()
    const pkg = getPackage("starter")!
    await expect(
      adapter.createCheckoutSession({
        package: pkg,
        currency: "USD",
        amountMinor: 1900,
        userId: "u",
        userEmail: null,
        successUrl: "https://example.com/a",
        cancelUrl: "https://example.com/b",
      })
    ).rejects.toThrow(/not configured/)
  })
})

function subscriptionBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event_id: "evt_01sub",
    event_type: "subscription.created",
    occurred_at: new Date().toISOString(),
    notification_id: "ntf_01sub",
    data: {
      id: "sub_01test12345678901234567890ab",
      status: "active",
      customer_id: "ctm_01test",
      currency_code: "USD",
      custom_data: { user_id: "00000000-0000-0000-0000-000000000001", plan_id: "studio" },
      items: [{ price: { id: "pri_studio_usd" }, quantity: 1 }],
      current_billing_period: { starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-01-31T00:00:00Z" },
      ...((overrides.data as Record<string, unknown>) ?? {}),
    },
    ...overrides,
  }
}

describe("subscription plans and events", () => {
  it("resolves plan price ids per currency and fails closed when absent", () => {
    expect(planPriceId("studio", "USD")).toBe("pri_studio_usd")
    expect(planPriceId("studio", "GBP")).toBeNull()
    expect(planPriceId("nope", "USD")).toBeNull()
    expect(planAndCurrencyForPrice("pri_firm_usd")).toEqual({ planId: "firm", currency: "USD" })
    expect(planAndCurrencyForPrice("pri_unknown")).toBeNull()
    expect(getPlan("studio")?.monthlyAllowance).toBe(300)
    expect(getPlan("nope")).toBeNull()
  })

  it("gates hosted checkout on client token plus USD prices", () => {
    expect(isSubscriptionCheckoutConfigured()).toBe(true)
    delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
    expect(isSubscriptionCheckoutConfigured()).toBe(false)
  })

  it("parses subscription lifecycle events with period bounds", () => {
    const event = parsePaddleSubscriptionEvent(subscriptionBody())
    expect(event.subscriptionId).toMatch(/^sub_/)
    expect(event.status).toBe("active")
    expect(event.priceId).toBe("pri_studio_usd")
    expect(event.userId).toBe("00000000-0000-0000-0000-000000000001")
    expect(event.orgId).toBeNull()
    expect(event.periodStart).toBe("2026-01-01T00:00:00Z")
    expect(event.periodEnd).toBe("2026-01-31T00:00:00Z")
    const base = subscriptionBody() as unknown as Record<string, unknown>
    const baseData = base.data as Record<string, unknown>
    const orgBody = {
      ...base,
      data: { ...baseData, custom_data: { user_id: "00000000-0000-0000-0000-000000000001", plan_id: "studio", org_id: "00000000-0000-0000-0000-000000000002" } },
    }
    expect(parsePaddleSubscriptionEvent(orgBody).orgId).toBe("00000000-0000-0000-0000-000000000002")
  })

  it("rejects non-subscription events and missing subscription ids", () => {
    expect(() => parsePaddleSubscriptionEvent({ event_type: "transaction.completed", data: {} })).toThrow(/not a subscription/i)
    const noId = subscriptionBody()
    ;((noId.data as Record<string, unknown>).id as unknown) = "txn_notasub"
    expect(() => parsePaddleSubscriptionEvent(noId)).toThrow(/subscription id/)
    const noPrice = subscriptionBody()
    ;((noPrice.data as Record<string, unknown>).items as unknown[]) = [{ price: {} }]
    expect(() => parsePaddleSubscriptionEvent(noPrice)).toThrow(/price id/)
  })

  it("resolves overage prices per currency and fails closed otherwise", () => {
    process.env.PADDLE_OVERAGE_USD = "pri_overage_usd"
    expect(overagePriceId("USD")).toBe("pri_overage_usd")
    expect(overagePriceId("GBP")).toBeNull()
    expect(overagePriceId("JPY")).toBeNull()
  })
})
