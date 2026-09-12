import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createHmac } from "node:crypto"
import {
  createMockAdapter,
  createLemonSqueezyAdapter,
  parseLemonOrderEvent,
  signWebhookBody,
  variantIdForPackage,
  packageIdForVariant,
  isLemonConfigured,
  getProviderAdapter,
} from "./provider"
import { getPackage } from "./catalog"

const OLD_ENV = { ...process.env }

function setLemonEnv() {
  process.env.LEMONSQUEEZY_STORE = "dealenz"
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "test-webhook-secret"
  process.env.LEMONSQUEEZY_VARIANT_STARTER = "111"
  process.env.LEMONSQUEEZY_VARIANT_STANDARD = "222"
  process.env.LEMONSQUEEZY_VARIANT_PRO = "333"
}

beforeEach(() => {
  setLemonEnv()
})

afterEach(() => {
  process.env = { ...OLD_ENV }
})

function orderBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    meta: {
      event_name: "order_created",
      custom_data: { user_id: "00000000-0000-0000-0000-000000000001", package_id: "standard" },
      test_mode: false,
    },
    data: {
      type: "orders",
      id: "123456",
      attributes: {
        status: "paid",
        total: 4900,
        currency: "USD",
        store_id: 1,
        user_email: "buyer@example.com",
        first_order_item: { product_id: 11, variant_id: "222" },
      },
    },
    ...overrides,
  })
}

describe("billing provider adapter — Lemon Squeezy", () => {
  it("reports configuration presence honestly", () => {
    expect(isLemonConfigured()).toBe(true)
    expect(variantIdForPackage("standard")).toBe("222")
    expect(packageIdForVariant("222")).toBe("standard")
    expect(packageIdForVariant("999")).toBeNull()
    delete process.env.LEMONSQUEEZY_VARIANT_PRO
    expect(isLemonConfigured()).toBe(false)
  })

  it("builds server-resolved buy links (no network, no client amounts)", async () => {
    const adapter = createLemonSqueezyAdapter()
    const pkg = getPackage("standard")!
    const session = await adapter.createCheckoutSession({
      package: pkg,
      currency: "USD",
      amountMinor: pkg.prices.USD,
      userId: "00000000-0000-0000-0000-000000000001",
      userEmail: "buyer@example.com",
      successUrl: "https://example.com/billing?checkout=success",
      cancelUrl: "https://example.com/billing?checkout=cancel",
    })
    expect(session.provider).toBe("lemonsqueezy")
    expect(session.url).toContain("https://dealenz.lemonsqueezy.com/buy/222?")
    expect(session.url).toContain("checkout%5Bcustom%5D%5Buser_id%5D=00000000-0000-0000-0000-000000000001")
  })

  it("fails closed without configuration", async () => {
    delete process.env.LEMONSQUEEZY_STORE
    const adapter = createLemonSqueezyAdapter()
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
    expect(getProviderAdapter().createCheckoutSession).toBeDefined()
  })

  it("verifies real HMAC signatures and rejects tampering", async () => {
    const adapter = createLemonSqueezyAdapter()
    const body = orderBody()
    const good = signWebhookBody(body, "test-webhook-secret")
    const verified = await adapter.verifyWebhook({ body, signature: good, secret: "test-webhook-secret" })
    expect(verified.providerTransactionId).toBe("123456")
    expect(verified.variantId).toBe("222")
    expect(verified.status).toBe("succeeded")
    expect(verified.testMode).toBe(false)
    // Cross-check against an independent HMAC computation.
    const independent = createHmac("sha256", "test-webhook-secret").update(body, "utf8").digest("hex")
    expect(good).toBe(independent)
    await expect(
      adapter.verifyWebhook({ body: body + " ", signature: good, secret: "test-webhook-secret" })
    ).rejects.toThrow(/signature/i)
    await expect(
      adapter.verifyWebhook({ body, signature: "0".repeat(64), secret: "test-webhook-secret" })
    ).rejects.toThrow(/signature/i)
  })

  it("rejects events missing order or variant ids (never fabricates identity)", async () => {
    const noId = JSON.parse(orderBody()) as Record<string, unknown>
    ;((noId.data as Record<string, unknown>).id as unknown) = null
    expect(() => parseLemonOrderEvent(noId)).toThrow(/order id/)
    const noVariant = JSON.parse(orderBody()) as Record<string, unknown>
    delete ((noVariant.data as Record<string, unknown>).attributes as Record<string, unknown>).first_order_item
    expect(() => parseLemonOrderEvent(noVariant)).toThrow(/variant id/)
  })

  it("rejects test-mode traffic unless explicitly allowed", async () => {
    const adapter = createLemonSqueezyAdapter()
    const body = orderBody()
    const parsed = JSON.parse(body) as Record<string, unknown>
    ;(parsed.meta as Record<string, unknown>).test_mode = true
    const testBody = JSON.stringify(parsed)
    const sig = signWebhookBody(testBody, "test-webhook-secret")
    await expect(adapter.verifyWebhook({ body: testBody, signature: sig, secret: "test-webhook-secret" })).rejects.toThrow(/test-mode/i)
    process.env.LEMONSQUEEZY_ALLOW_TEST_MODE = "1"
    const verified = await adapter.verifyWebhook({ body: testBody, signature: sig, secret: "test-webhook-secret" })
    expect(verified.testMode).toBe(true)
  })

  it("maps refund and non-paid statuses without granting semantics", () => {
    const refunded = parseLemonOrderEvent(
      JSON.parse(
        orderBody({
          meta: { event_name: "order_refunded", custom_data: {}, test_mode: false },
        })
      )
    )
    expect(refunded.status).toBe("refunded")
    expect(() => parseLemonOrderEvent({ meta: { event_name: "subscription_created" } })).toThrow(/unsupported/i)
  })

  it("mock adapter stays Lemon Squeezy-shaped and deterministic", async () => {
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
    expect(session.provider).toBe("lemonsqueezy")
    expect(session.url).not.toContain("stripe")
  })
})
