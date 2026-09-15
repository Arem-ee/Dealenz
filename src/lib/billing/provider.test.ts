import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createHmac } from "node:crypto"
import {
  createMockAdapter,
  createPaddleAdapter,
  parsePaddleTransactionEvent,
  priceIdForPackage,
  packageIdForPrice,
  isPaddleConfigured,
  verifyPaddleSignature,
} from "./provider"
import { getPackage } from "./catalog"

const OLD_ENV = { ...process.env }

function setPaddleEnv() {
  process.env.PADDLE_API_KEY = "pdl_live_apikey_test"
  process.env.PADDLE_WEBHOOK_SECRET = "pdl_ntfset_test_secret_1234567890abcdef"
  process.env.PADDLE_PRICE_STARTER = "pri_starter_111"
  process.env.PADDLE_PRICE_STANDARD = "pri_standard_222"
  process.env.PADDLE_PRICE_PRO = "pri_pro_333"
  process.env.PADDLE_ENVIRONMENT = "sandbox"
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
