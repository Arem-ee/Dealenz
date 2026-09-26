// Payment provider adapter — Paddle Billing for US/UK/Europe.
//
// Paddle is the single payment provider (Merchant of Record: tax and
// compliance handled by Paddle's checkout). Isolated behind a small domain
// boundary. Credit ledger remains the source of truth; the provider is
// settlement only. No second ledger.
//
// Live configuration required (see .env.example): API key, webhook secret,
// environment, and one price id per catalog package. Missing configuration
// fails closed.

import { createHmac, timingSafeEqual } from "node:crypto"
import type { CreditPackage, Currency } from "./catalog"
import { Paddle, Environment } from "@paddle/paddle-node-sdk"

export interface CheckoutSession {
  id: string
  url: string
  provider: "paddle"
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
  /** Paddle event name, e.g. "transaction.completed". */
  type: string
  /** Stable Paddle transaction id (txn_...). Never fabricated: missing id rejects. */
  providerTransactionId: string
  /** Server-resolved price id from the transaction payload. */
  priceId: string
  /** Transaction total in minor units, as reported by Paddle. */
  totalMinor: number
  currency: string
  /** Attributed user id from custom_data (validated as UUID downstream). */
  userId: string
  status: "succeeded" | "failed" | "canceled" | "refunded" | "disputed"
  raw: unknown
}

const PRICE_ENV: Record<string, string> = {
  starter: "PADDLE_PRICE_STARTER",
  standard: "PADDLE_PRICE_STANDARD",
  pro: "PADDLE_PRICE_PRO",
}

const PRICE_CURRENCIES = ["USD", "GBP", "EUR"] as const

/**
 * Resolve the Paddle price id for a package in a buyer currency.
 *
 * Paddle one-time prices are single-currency entities, so each package
 * needs one price per currency it sells in (`PADDLE_PRICE_STANDARD_GBP`,
 * …). The legacy bare variable (`PADDLE_PRICE_STANDARD`) is USD-denominated
 * and resolves for USD only — it must never silently charge a GBP/EUR buyer
 * a USD price while the UI shows them £/€. A currency with no price for any
 * active package resolves null and the checkout route fails closed for it.
 */
export function priceIdForPackage(packageId: string, currency?: string): string | null {
  const envVar = PRICE_ENV[packageId]
  if (!envVar) return null
  if (currency && currency !== "USD") {
    const specific = (process.env[`${envVar}_${currency}`] ?? "").trim()
    return specific.length > 0 ? specific : null
  }
  const legacy = (process.env[envVar] ?? "").trim()
  if (legacy.length > 0) return legacy
  if (currency === "USD") {
    const specific = (process.env[`${envVar}_USD`] ?? "").trim()
    return specific.length > 0 ? specific : null
  }
  return legacy.length > 0 ? legacy : null
}

export function packageIdForPrice(priceId: string): string | null {
  if (!priceId) return null
  for (const [packageId, envVar] of Object.entries(PRICE_ENV)) {
    for (const suffix of ["", "_USD", "_GBP", "_EUR"]) {
      if ((process.env[`${envVar}${suffix}`] ?? "").trim() === priceId) {
        return packageId
      }
    }
  }
  return null
}

/** Buyer currencies where every active package has a resolvable price. */
export function enabledCurrencies(activePackageIds: string[]): string[] {
  return PRICE_CURRENCIES.filter((currency) =>
    activePackageIds.every((id) => priceIdForPackage(id, currency) !== null)
  )
}

export function paddleApiKey(): string | null {
  const key = (process.env.PADDLE_API_KEY ?? "").trim()
  return key.length > 0 ? key : null
}

export function paddleWebhookSecret(): string | null {
  const secret = (process.env.PADDLE_WEBHOOK_SECRET ?? "").trim()
  return secret.length > 0 ? secret : null
}

export function paddleEnvironment(): Environment {
  const env = (process.env.PADDLE_ENVIRONMENT ?? "").trim().toLowerCase()
  if (env === "sandbox") return Environment.sandbox
  return Environment.production
}

export function isPaddleConfigured(): boolean {
  if (!paddleApiKey()) return false
  if (!paddleWebhookSecret()) return false
  return ["starter", "standard", "pro"].every((id) => priceIdForPackage(id) !== null)
}

export function signWebhookBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex")
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null
  return value as Record<string, unknown>
}

export function verifyPaddleSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !secret) return false
  // Paddle sends at least one h1 and adds more during secret rotation, so
  // every presented signature is a candidate — accepting only the first
  // would reject genuine webhooks mid-rotation.
  const h1Candidates: string[] = []
  let ts: string | null = null
  for (const part of signatureHeader.split(";")) {
    const [k, v] = part.split("=")
    if (k === "ts" && ts === null) ts = v ?? null
    if (k === "h1" && v) h1Candidates.push(v)
  }
  if (!ts || h1Candidates.length === 0) return false
  const age = Math.floor(Date.now() / 1000) - Number(ts)
  if (!Number.isFinite(age) || Math.abs(age) > 300) return false
  const signedPayload = `${ts}:${rawBody}`
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex")
  return h1Candidates.some((h1) => {
    if (h1.length !== expected.length) return false
    try {
      return timingSafeEqual(Buffer.from(h1, "utf8"), Buffer.from(expected, "utf8"))
    } catch {
      return false
    }
  })
}

export function parsePaddleTransactionEvent(parsed: unknown): Omit<VerifiedEvent, "raw"> {
  const root = asRecord(parsed)
  if (!root) throw new Error("Invalid Paddle event: not an object")
  const eventType = typeof root.event_type === "string" ? root.event_type : ""
  // Refunds arrive as transaction.updated, not completed: accept the event
  // type and let the status mapping decide (only "refunded" passes below).
  // Disputes/chargebacks arrive as transaction.dispute.* or as updated
  // transactions carrying a disputed-family status: accept both shapes and
  // map them to "disputed" (revoked exactly like a refund — money back means
  // credits back). Unknown money-back shapes stay rejected (fail closed).
  const isDisputeEvent = eventType.startsWith("transaction.dispute")
  if (eventType !== "transaction.completed" && eventType !== "transaction.paid" && eventType !== "transaction.updated" && !isDisputeEvent) {
    throw new Error(`Unsupported Paddle event: ${eventType || "(missing)"}`)
  }
  const data = asRecord(root.data)
  if (!data) throw new Error("Paddle event is missing data")
  const id = typeof data.id === "string" ? data.id : ""
  if (!id || !id.startsWith("txn_")) throw new Error("Paddle event is missing its transaction id; refusing to fulfill")
  const statusRaw = typeof data.status === "string" ? data.status : ""
  let status: VerifiedEvent["status"]
  if (statusRaw === "completed" || statusRaw === "paid") status = "succeeded"
  else if (statusRaw === "canceled") status = "canceled"
  else if (statusRaw === "refunded") status = "refunded"
  else if (statusRaw === "disputed" || statusRaw === "chargeback" || statusRaw === "reversed" || isDisputeEvent) status = "disputed"
  else throw new Error(`Paddle transaction is not in a fulfillable state: ${statusRaw}`)
  const items = Array.isArray(data.items) ? data.items as unknown[] : []
  const firstItem = asRecord(items[0] as unknown)
  const price = asRecord(firstItem?.price as unknown)
  const priceId = typeof price?.id === "string" ? price.id : (typeof firstItem?.price_id === "string" ? (firstItem.price_id as string) : "")
  if (!priceId) throw new Error("Paddle event is missing its price id; refusing to fulfill")
  const customData = asRecord(data.custom_data)
  const customUserId = typeof customData?.user_id === "string" ? (customData.user_id as string).trim() : ""
  const details = asRecord(data.details)
  const totals = asRecord(details?.totals)
  const totalStr = typeof totals?.total === "string" ? totals.total : (typeof totals?.grand_total === "string" ? totals.grand_total as string : "")
  const currencyRaw = typeof details?.totals === "object" && details?.totals !== null ? (totals?.currency_code as string) : (typeof data.currency_code === "string" ? data.currency_code as string : "")
  const currency = (currencyRaw ?? "").toUpperCase()
  let totalMinor = NaN
  if (totalStr && /^\d+$/.test(totalStr)) totalMinor = parseInt(totalStr, 10)
  else if (typeof totals?.total === "number") totalMinor = totals.total as number
  if (!Number.isFinite(totalMinor) || totalMinor < 0) throw new Error("Paddle event has an invalid total; refusing to fulfill")
  return {
    type: eventType,
    providerTransactionId: id,
    priceId,
    totalMinor,
    currency: currency || "USD",
    userId: customUserId,
    status,
  }
}

export function createPaddleAdapter(): ProviderAdapter {
  return {
    async createCheckoutSession(input) {
      const apiKey = paddleApiKey()
      // Currency-scoped: a GBP buyer must resolve a GBP price, never fall
      // back to a USD price id while the UI shows £ amounts.
      const priceId = priceIdForPackage(input.package.id, input.currency)
      if (!apiKey || !priceId) {
        throw new Error(
          priceId
            ? "Paddle is not configured (API key missing)"
            : `This package is not available in ${input.currency} yet — switch currency or try again later`
        )
      }
      const environment = paddleEnvironment()
      const paddle = new Paddle(apiKey, { environment })
      // NOTE: POST /transactions accepts customer_id only — there is no
      // `customer: { email }` field, so buyer email is prefilled client-side
      // via Paddle.Checkout.open({ customer }) instead (see purchase-section).
      const transaction = await paddle.transactions.create({
        items: [{ priceId, quantity: 1 }],
        currencyCode: input.currency,
        customData: { user_id: input.userId, package_id: input.package.id },
      })
      const data = transaction as unknown as Record<string, unknown>
      const checkout = asRecord(data.checkout)
      const url = typeof checkout?.url === "string" ? checkout.url : ""
      const id = typeof data.id === "string" ? data.id : `txn_${Date.now()}`
      if (!url) throw new Error("Paddle did not return a checkout URL")
      return { id, url, provider: "paddle" }
    },
    async verifyWebhook(input) {
      if (!input.secret) throw new Error("PADDLE_WEBHOOK_SECRET is not configured")
      if (!input.signature) throw new Error("Missing Paddle-Signature header")
      if (!verifyPaddleSignature(input.body, input.signature, input.secret)) {
        throw new Error("Invalid Paddle webhook signature")
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(input.body)
      } catch {
        throw new Error("Invalid webhook body")
      }
      const event = parsePaddleTransactionEvent(parsed)
      return { ...event, raw: parsed }
    },
  }
}

export function createMockAdapter(): ProviderAdapter {
  return {
    async createCheckoutSession(input) {
      const id = `txn_test_${input.package.id}_${input.currency}_${Date.now()}`
      const url = `https://checkout.example.invalid/paddle/${input.package.id}?user=${input.userId}`
      return { id, url, provider: "paddle" }
    },
    async verifyWebhook(input) {
      let parsed: unknown
      try {
        parsed = JSON.parse(input.body)
      } catch {
        throw new Error("Invalid webhook body")
      }
      if (input.signature !== "test" && input.signature !== null) {
        void 0
      }
      const event = parsePaddleTransactionEvent(parsed)
      return { ...event, raw: parsed }
    },
  }
}

export function getProviderAdapter(): ProviderAdapter {
  if (isPaddleConfigured()) {
    return createPaddleAdapter()
  }
  return createMockAdapter()
}

export function getPaddleAdapter(): ProviderAdapter {
  return getProviderAdapter()
}
