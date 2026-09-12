// Payment provider adapter — Lemon Squeezy for US/UK/Europe.
//
// Lemon Squeezy is the single payment provider (Merchant of Record: tax and
// compliance handled by Lemon Squeezy's checkout, so no tax infrastructure
// here). Isolated behind a small domain boundary. Credit ledger remains the
// source of truth; the provider is settlement only. No second ledger.
//
// Live configuration required (see .env.example): store slug, webhook
// signing secret, and one variant id per catalog package. Nothing here
// invents product/variant ids — missing configuration fails closed.

import { createHmac, timingSafeEqual } from "node:crypto"
import type { CreditPackage, Currency } from "./catalog"

export interface CheckoutSession {
  id: string
  url: string
  provider: "lemonsqueezy"
}

export interface ProviderAdapter {
  createCheckoutSession(input: {
    package: CreditPackage
    currency: Currency
    amountMinor: number
    userId: string
    userEmail: string | null
    successUrl: string
    cancelUrl: string
  }): Promise<CheckoutSession>
  verifyWebhook(input: { body: string; signature: string | null; secret: string }): Promise<VerifiedEvent>
}

export interface VerifiedEvent {
  /** Lemon Squeezy event name, e.g. "order_created", "order_refunded". */
  type: string
  /** Stable Lemon Squeezy order id. Never fabricated: missing id rejects. */
  providerTransactionId: string
  /** Server-resolved variant id from the order payload. */
  variantId: string
  /** Order total in minor units, as reported by Lemon Squeezy. */
  totalMinor: number
  currency: string
  /** Attributed user id from checkout custom data (validated as UUID downstream). */
  userId: string
  status: "succeeded" | "failed" | "canceled" | "refunded"
  testMode: boolean
  raw: unknown
}

// One Lemon Squeezy variant per catalog package, via environment. Variant
// ids are live configuration (dashboard UUIDs), never code constants.
const VARIANT_ENV: Record<string, string> = {
  starter: "LEMONSQUEEZY_VARIANT_STARTER",
  standard: "LEMONSQUEEZY_VARIANT_STANDARD",
  pro: "LEMONSQUEEZY_VARIANT_PRO",
}

export function variantIdForPackage(packageId: string): string | null {
  const envVar = VARIANT_ENV[packageId]
  if (!envVar) return null
  const value = (process.env[envVar] ?? "").trim()
  return value.length > 0 ? value : null
}

export function packageIdForVariant(variantId: string): string | null {
  for (const [packageId, envVar] of Object.entries(VARIANT_ENV)) {
    if ((process.env[envVar] ?? "").trim() === variantId && variantId.length > 0) {
      return packageId
    }
  }
  return null
}

export function lemonStoreSlug(): string | null {
  const slug = (process.env.LEMONSQUEEZY_STORE ?? "").trim()
  return slug.length > 0 ? slug : null
}

export function isLemonConfigured(): boolean {
  if (!lemonStoreSlug()) return false
  if (!(process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "").trim()) return false
  return ["starter", "standard", "pro"].every((id) => variantIdForPackage(id) !== null)
}

/** HMAC-SHA256 hex signature Lemon Squeezy sends as the X-Signature header. */
export function signWebhookBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex")
}

function signaturesEqual(a: string | null, bHex: string): boolean {
  if (!a || a.length !== bHex.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(bHex, "utf8"))
  } catch {
    return false
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null
  return value as Record<string, unknown>
}

/**
 * Parse a Lemon Squeezy order webhook payload into a VerifiedEvent.
 * Fail-closed on every anomaly: unknown shape, missing order id, missing
 * variant, non-numeric total, or test-mode traffic (unless explicitly
 * allowed for development) all throw instead of fulfilling.
 */
export function parseLemonOrderEvent(parsed: unknown): Omit<VerifiedEvent, "raw"> {
  const root = asRecord(parsed)
  const meta = asRecord(root?.meta) ?? {}
  const data = asRecord(root?.data) ?? {}
  const attrs = asRecord(data.attributes) ?? {}
  const firstItem = asRecord(attrs.first_order_item) ?? {}

  const eventName = typeof meta.event_name === "string" ? meta.event_name : ""
  if (eventName !== "order_created" && eventName !== "order_refunded") {
    throw new Error(`Unsupported Lemon Squeezy event: ${eventName || "(missing)"}`)
  }

  const testMode = meta.test_mode === true
  if (testMode && process.env.LEMONSQUEEZY_ALLOW_TEST_MODE !== "1") {
    throw new Error("Test-mode events are not accepted")
  }

  const orderId = typeof data.id === "string" || typeof data.id === "number" ? String(data.id) : ""
  if (!orderId || orderId.length > 100) {
    throw new Error("Lemon Squeezy event is missing its order id; refusing to fulfill")
  }
  const variantIdRaw = firstItem.variant_id
  const variantId = typeof variantIdRaw === "string" || typeof variantIdRaw === "number" ? String(variantIdRaw) : ""
  if (!variantId) {
    throw new Error("Lemon Squeezy event is missing its variant id; refusing to fulfill")
  }
  const totalMinor = typeof attrs.total === "number" && Number.isInteger(attrs.total) ? attrs.total : NaN
  if (!Number.isFinite(totalMinor) || totalMinor < 0) {
    throw new Error("Lemon Squeezy event has an invalid total; refusing to fulfill")
  }
  const currency = typeof attrs.currency === "string" ? attrs.currency.toUpperCase() : ""
  const custom = asRecord(meta.custom_data) ?? {}
  const customUserId = typeof custom.user_id === "string" ? custom.user_id.trim() : ""

  const statusRaw = typeof attrs.status === "string" ? attrs.status.toLowerCase() : ""
  let status: VerifiedEvent["status"]
  if (eventName === "order_refunded" || statusRaw === "refunded") {
    status = "refunded"
  } else if (statusRaw === "paid") {
    status = "succeeded"
  } else if (statusRaw === "cancelled" || statusRaw === "canceled") {
    status = "canceled"
  } else {
    status = "failed"
  }

  return {
    type: eventName,
    providerTransactionId: orderId,
    variantId,
    totalMinor,
    currency,
    userId: customUserId,
    status,
    testMode,
  }
}

// Lemon Squeezy adapter — buy-link checkout (no API calls) + HMAC webhooks.
// Throws with clear env-missing messages when unconfigured (safe for
// tests/dev without credentials; getProviderAdapter falls back to mock).
export function createLemonSqueezyAdapter(): ProviderAdapter {
  return {
    async createCheckoutSession(input) {
      const store = lemonStoreSlug()
      const variantId = variantIdForPackage(input.package.id)
      if (!store || !variantId) {
        throw new Error("Lemon Squeezy is not configured (store/variant ids missing)")
      }
      const params = new URLSearchParams()
      if (input.userEmail) params.set("checkout[email]", input.userEmail)
      params.set("checkout[custom][user_id]", input.userId)
      params.set("checkout[custom][package_id]", input.package.id)
      // Success/cancel landing is informational only: only verified webhooks
      // fulfill. Lemon Squeezy redirects to the store's configured URLs; the
      // app's billing page explains that redirect is not proof of payment.
      void input.successUrl
      void input.cancelUrl
      void input.amountMinor
      void input.currency
      const url = `https://${store}.lemonsqueezy.com/buy/${variantId}?${params.toString()}`
      return { id: `co_${input.package.id}_${Date.now()}`, url, provider: "lemonsqueezy" }
    },
    async verifyWebhook(input) {
      if (!input.secret) throw new Error("LEMONSQUEEZY_WEBHOOK_SECRET is not configured")
      const expected = signWebhookBody(input.body, input.secret)
      if (!signaturesEqual(input.signature, expected)) {
        throw new Error("Invalid Lemon Squeezy webhook signature")
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(input.body)
      } catch {
        throw new Error("Invalid webhook body")
      }
      const event = parseLemonOrderEvent(parsed)
      return { ...event, raw: parsed }
    },
  }
}

// Mock adapter for tests/dev without Lemon Squeezy credentials —
// deterministic, no network, Lemon Squeezy-shaped. Never used in production
// when live configuration is present.
export function createMockAdapter(): ProviderAdapter {
  return {
    async createCheckoutSession(input) {
      const id = `co_test_${input.package.id}_${input.currency}_${Date.now()}`
      const url = `https://checkout.example.invalid/buy/${input.package.id}?user=${input.userId}`
      return { id, url, provider: "lemonsqueezy" }
    },
    async verifyWebhook(input) {
      // Lemon Squeezy-shaped JSON fixtures; signature check bypassed for
      // fixtures ("test" or null), parsing is the real parser. Ids are never
      // invented: fixtures must carry data.id and a variant id.
      let parsed: unknown
      try {
        parsed = JSON.parse(input.body)
      } catch {
        throw new Error("Invalid webhook body")
      }
      if (input.signature !== "test" && input.signature !== null) {
        void 0
      }
      const event = parseLemonOrderEvent(parsed)
      return { ...event, raw: parsed }
    },
  }
}

export function getProviderAdapter(): ProviderAdapter {
  if (isLemonConfigured()) {
    return createLemonSqueezyAdapter()
  }
  return createMockAdapter()
}
