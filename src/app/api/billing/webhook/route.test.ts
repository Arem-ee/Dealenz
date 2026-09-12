import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { createHmac } from "node:crypto"

const mockVerify = vi.hoisted(() => vi.fn())
const inserts: Array<{ table: string; row: Record<string, unknown> }> = vi.hoisted(() => [])
const failLedger = vi.hoisted(() => ({ value: false }))
const failPurchaseInsertDuplicate = vi.hoisted(() => ({ value: false }))
const existingPurchase = vi.hoisted(() => ({ value: null as null | { status: string } }))
const existingGrant = vi.hoisted(() => ({ value: null as null | { id: string } }))

vi.mock("@/lib/billing/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/provider")>()
  return {
    ...actual,
    getProviderAdapter: vi.fn(() => ({ verifyWebhook: mockVerify })),
  }
})

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: (table: string) => tableMock(table) })),
}))

function tableMock(table: string) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => {
    if (table === "credit_purchases") {
      return Promise.resolve({ data: existingPurchase.value, error: null })
    }
    if (table === "credit_ledger") {
      return Promise.resolve({ data: existingGrant.value, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })
  builder.update = vi.fn(() => builder)
  builder.insert = vi.fn((row: Record<string, unknown>) => {
    inserts.push({ table, row })
    if (table === "credit_ledger" && failLedger.value) {
      return Promise.resolve({ error: { message: "ledger exploded" } })
    }
    if (table === "credit_purchases" && failPurchaseInsertDuplicate.value) {
      return Promise.resolve({ error: { message: 'duplicate key value violates unique constraint "credit_purchases_provider_tx_unique"' } })
    }
    return Promise.resolve({ error: null })
  })
  return builder
}

import { POST } from "./route"
import { parseLemonOrderEvent } from "@/lib/billing/provider"

const USER_ID = "00000000-0000-0000-0000-000000000001"
const SECRET = "test-webhook-secret"

function lemonBody(overrides: { meta?: Record<string, unknown>; data?: Record<string, unknown> } = {}): string {
  return JSON.stringify({
    meta: {
      event_name: "order_created",
      custom_data: { user_id: USER_ID, package_id: "standard" },
      test_mode: false,
      ...(overrides.meta ?? {}),
    },
    data: {
      type: "orders",
      id: "80001",
      attributes: {
        status: "paid",
        total: 4900,
        currency: "USD",
        store_id: 1,
        user_email: "buyer@example.com",
        first_order_item: { product_id: 11, variant_id: "222" },
      },
      ...(overrides.data ?? {}),
    },
  })
}

const OLD_ENV = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  inserts.length = 0
  existingPurchase.value = null
  existingGrant.value = null
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET
  process.env.LEMONSQUEEZY_STORE = "dealenz"
  process.env.LEMONSQUEEZY_VARIANT_STARTER = "111"
  process.env.LEMONSQUEEZY_VARIANT_STANDARD = "222"
  process.env.LEMONSQUEEZY_VARIANT_PRO = "333"
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"
  mockVerify.mockImplementation(({ body, signature }: { body: string; signature: string | null }) => {
    // Mirror the real adapter's contract through the same parser, with an
    // independent signature check so the test exercises real verification.
    const expected = createHmac("sha256", SECRET).update(body, "utf8").digest("hex")
    if (signature !== expected) throw new Error("Invalid Lemon Squeezy webhook signature")
    const event = parseLemonOrderEvent(JSON.parse(body))
    return Promise.resolve({ ...event, raw: JSON.parse(body) })
  })
})

afterEach(() => {
  process.env = { ...OLD_ENV }
})

function reqWithSig(body: string): NextRequest {
  const sig = createHmac("sha256", SECRET).update(body, "utf8").digest("hex")
  return new NextRequest("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: { "x-signature": sig },
    body,
  })
}

describe("billing webhook (Lemon Squeezy) fulfillment", () => {
  it("fulfills a valid paid order exactly once", async () => {
    const res = await POST(reqWithSig(lemonBody()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, credits: 150 })
    expect(inserts.filter((i) => i.table === "credit_ledger")).toHaveLength(1)
    expect(inserts.filter((i) => i.table === "system_logs")).toHaveLength(0)
  })

  it("rejects invalid signatures with 400 and a warn record", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: { "x-signature": "0".repeat(64) },
        body: lemonBody(),
      })
    )
    expect(res.status).toBe(400)
    const logs = inserts.filter((i) => i.table === "system_logs")
    expect(logs).toHaveLength(1)
    expect(logs[0].row.phase).toBe("billing_webhook")
    expect(logs[0].row.severity).toBe("warn")
  })

  it("records ledger failures as critical events without secrets", async () => {
    failLedger.value = true
    try {
      const res = await POST(reqWithSig(lemonBody()))
      expect(res.status).toBe(500)
      const logs = inserts.filter((i) => i.table === "system_logs")
      expect(logs).toHaveLength(1)
      expect(logs[0].row.phase).toBe("billing_webhook")
      expect(logs[0].row.severity).toBe("critical")
      expect(JSON.stringify(logs[0].row)).not.toContain(SECRET)
      expect(JSON.stringify(logs[0].row)).not.toContain("test-service-key")
    } finally {
      failLedger.value = false
    }
  })

  it("replays of succeeded purchases do not re-grant when the grant landed", async () => {
    existingPurchase.value = { status: "succeeded" }
    existingGrant.value = { id: "grant-1" }
    const res = await POST(reqWithSig(lemonBody()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, idempotent: true })
    expect(inserts.some((i) => i.table === "credit_ledger")).toBe(false)
  })

  it("repairs lost entitlements when purchase succeeded but the grant is missing", async () => {
    existingPurchase.value = { status: "succeeded" }
    existingGrant.value = null
    const res = await POST(reqWithSig(lemonBody()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, repaired: true })
    const grants = inserts.filter((i) => i.table === "credit_ledger")
    expect(grants).toHaveLength(1)
    expect(grants[0].row.idempotency_key).toBe("purchase:80001")
  })

  it("converges concurrent duplicate deliveries without a second provider retry", async () => {
    existingPurchase.value = null
    existingGrant.value = null
    failPurchaseInsertDuplicate.value = true
    try {
      const res = await POST(reqWithSig(lemonBody()))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ received: true, repaired: true })
      expect(inserts.filter((i) => i.table === "credit_ledger")).toHaveLength(1)
    } finally {
      failPurchaseInsertDuplicate.value = false
    }
  })

  it("records refund notifications visibly without mutating credits", async () => {
    const res = await POST(reqWithSig(lemonBody({ meta: { event_name: "order_refunded" } })))
    expect(res.status).toBe(200)
    expect(inserts.some((i) => i.table === "credit_ledger")).toBe(false)
    const logs = inserts.filter((i) => i.table === "system_logs")
    expect(logs).toHaveLength(1)
    expect(logs[0].row.severity).toBe("warn")
    expect(JSON.stringify(logs[0].row)).toContain("order_refunded")
  })

  it("returns 400 for malformed events without credit mutation", async () => {
    const res = await POST(reqWithSig(lemonBody({ meta: { event_name: "order_created", custom_data: {} } })))
    expect(res.status).toBe(400)
    expect(inserts.some((i) => i.table === "credit_ledger")).toBe(false)
  })

  it("rejects underpayment below the catalog floor", async () => {
    const res = await POST(
      reqWithSig(
        lemonBody({ data: { type: "orders", id: "80002", attributes: { status: "paid", total: 100, currency: "USD", first_order_item: { variant_id: "222" } } } })
      )
    )
    expect(res.status).toBe(400)
    expect(inserts.some((i) => i.table === "credit_ledger")).toBe(false)
  })

  it("rejects unknown variants without credit mutation", async () => {
    const res = await POST(
      reqWithSig(
        lemonBody({ data: { type: "orders", id: "80003", attributes: { status: "paid", total: 4900, currency: "USD", first_order_item: { variant_id: "999" } } } })
      )
    )
    expect(res.status).toBe(400)
    expect(inserts.some((i) => i.table === "credit_ledger")).toBe(false)
  })
})
