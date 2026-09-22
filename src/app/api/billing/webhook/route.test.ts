import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { createHmac } from "node:crypto"

const mockVerify = vi.hoisted(() => vi.fn())
const inserts: Array<{ table: string; row: Record<string, unknown> }> = vi.hoisted(() => [])
const updates: Array<{ table: string; row: Record<string, unknown> }> = vi.hoisted(() => [])
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
  builder.update = vi.fn((row: Record<string, unknown>) => {
    updates.push({ table, row })
    return builder
  })
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
import { parsePaddleTransactionEvent } from "@/lib/billing/provider"

const USER_ID = "00000000-0000-0000-0000-000000000001"
const SECRET = "pdl_ntfset_test_secret_1234567890abcdef"

function paddleBody(overrides: { event_type?: string; data?: Record<string, unknown> } = {}): string {
  return JSON.stringify({
    event_id: "evt_01test",
    event_type: overrides.event_type ?? "transaction.completed",
    occurred_at: new Date().toISOString(),
    notification_id: "ntf_01test",
    data: {
      id: "txn_01test12345678901234567890ab",
      status: "completed",
      customer_id: "ctm_01test",
      currency_code: "USD",
      custom_data: { user_id: USER_ID, package_id: "standard" },
      items: [{ price: { id: "pri_standard_222" }, quantity: 1 }],
      details: { totals: { total: "2499", currency_code: "USD" } },
      ...(overrides.data ?? {}),
    },
  })
}

function paddleSig(body: string): string {
  const ts = Math.floor(Date.now() / 1000).toString()
  const h1 = createHmac("sha256", SECRET).update(`${ts}:${body}`, "utf8").digest("hex")
  return `ts=${ts};h1=${h1}`
}

const OLD_ENV = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  inserts.length = 0
  updates.length = 0
  existingPurchase.value = null
  existingGrant.value = null
  process.env.PADDLE_WEBHOOK_SECRET = SECRET
  process.env.PADDLE_API_KEY = "pdl_test_key"
  process.env.PADDLE_PRICE_STARTER = "pri_starter_111"
  process.env.PADDLE_PRICE_STANDARD = "pri_standard_222"
  process.env.PADDLE_PRICE_PRO = "pri_pro_333"
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"
  mockVerify.mockImplementation(({ body, signature }: { body: string; signature: string | null }) => {
    const expected = (() => {
      const parts = (signature ?? "").split(";")
      let ts: string | null = null
      let h1: string | null = null
      for (const p of parts) { const [k, v] = p.split("="); if (k === "ts") ts = v; if (k === "h1") h1 = v }
      if (!ts || !h1) throw new Error("Invalid Paddle webhook signature")
      const exp = createHmac("sha256", SECRET).update(`${ts}:${body}`, "utf8").digest("hex")
      if (h1 !== exp) throw new Error("Invalid Paddle webhook signature")
      return exp
    })()
    void expected
    const event = parsePaddleTransactionEvent(JSON.parse(body))
    return Promise.resolve({ ...event, raw: JSON.parse(body) })
  })
})

afterEach(() => {
  process.env = { ...OLD_ENV }
})

function reqWithSig(body: string): NextRequest {
  const sig = paddleSig(body)
  return new NextRequest("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: { "paddle-signature": sig },
    body,
  })
}

describe("billing webhook (Paddle) fulfillment", () => {
  it("fulfills a valid paid transaction exactly once", async () => {
    const res = await POST(reqWithSig(paddleBody()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, credits: 150 })
    expect(inserts.filter((i) => i.table === "credit_ledger")).toHaveLength(1)
    expect(inserts.filter((i) => i.table === "system_logs")).toHaveLength(0)
  })

  it("rejects invalid signatures with 400 and a warn record", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: { "paddle-signature": "ts=1;h1=0".repeat(32) },
        body: paddleBody(),
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
      const res = await POST(reqWithSig(paddleBody()))
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
    const res = await POST(reqWithSig(paddleBody()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, idempotent: true })
    expect(inserts.some((i) => i.table === "credit_ledger")).toBe(false)
  })

  it("repairs lost entitlements when purchase succeeded but the grant is missing", async () => {
    existingPurchase.value = { status: "succeeded" }
    existingGrant.value = null
    const res = await POST(reqWithSig(paddleBody()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, repaired: true })
    const grants = inserts.filter((i) => i.table === "credit_ledger")
    expect(grants).toHaveLength(1)
    expect(grants[0].row.idempotency_key).toBe("purchase:txn_01test12345678901234567890ab")
  })

  it("finalizes a pending purchase to succeeded and grants exactly once", async () => {
    existingPurchase.value = { status: "pending" }
    existingGrant.value = null
    const res = await POST(reqWithSig(paddleBody()))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, credits: 150 })
    const purchaseUpdates = updates.filter((u) => u.table === "credit_purchases")
    expect(purchaseUpdates).toHaveLength(1)
    expect(purchaseUpdates[0].row.status).toBe("succeeded")
    const grants = inserts.filter((i) => i.table === "credit_ledger")
    expect(grants).toHaveLength(1)
    expect(grants[0].row.idempotency_key).toBe("purchase:txn_01test12345678901234567890ab")
  })

  it("converges concurrent duplicate deliveries without a second provider retry", async () => {
    existingPurchase.value = null
    existingGrant.value = null
    failPurchaseInsertDuplicate.value = true
    try {
      const res = await POST(reqWithSig(paddleBody()))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ received: true, repaired: true })
      expect(inserts.filter((i) => i.table === "credit_ledger")).toHaveLength(1)
    } finally {
      failPurchaseInsertDuplicate.value = false
    }
  })

  it("records refund-like non-succeeded statuses visibly without mutating credits", async () => {
    const body = paddleBody({ data: { id: "txn_01test12345678901234567890ab", status: "canceled", customer_id: "ctm_01test", currency_code: "USD", custom_data: { user_id: USER_ID }, items: [{ price: { id: "pri_standard_222" } }], details: { totals: { total: "4900", currency_code: "USD" } } } })
    const res = await POST(reqWithSig(body))
    expect(res.status).toBe(200)
    expect(inserts.some((i) => i.table === "credit_ledger")).toBe(false)
  })

  it("returns 400 for malformed events without credit mutation", async () => {
    const res = await POST(reqWithSig(paddleBody({ data: { id: "txn_01test12345678901234567890ab", status: "completed", customer_id: "ctm_01test", currency_code: "USD", custom_data: {}, items: [{ price: { id: "pri_standard_222" } }], details: { totals: { total: "4900", currency_code: "USD" } } } })))
    expect(res.status).toBe(400)
    expect(inserts.some((i) => i.table === "credit_ledger")).toBe(false)
  })

  it("returns 400 for non-UUID user attribution without credit mutation", async () => {
    const res = await POST(reqWithSig(paddleBody({ data: { id: "txn_01test12345678901234567890ab", status: "completed", customer_id: "ctm_01test", currency_code: "USD", custom_data: { user_id: "not-a-uuid" }, items: [{ price: { id: "pri_standard_222" } }], details: { totals: { total: "4900", currency_code: "USD" } } } })))
    expect(res.status).toBe(400)
    expect(inserts.some((i) => i.table === "credit_ledger")).toBe(false)
    expect(inserts.some((i) => i.table === "credit_purchases")).toBe(false)
  })

  it("rejects underpayment below the catalog floor", async () => {
    const res = await POST(
      reqWithSig(
        paddleBody({ data: { id: "txn_01test12345678901234567890ac", status: "completed", customer_id: "ctm_01test", currency_code: "USD", custom_data: { user_id: USER_ID }, items: [{ price: { id: "pri_standard_222" } }], details: { totals: { total: "100", currency_code: "USD" } } } })
      )
    )
    expect(res.status).toBe(400)
    expect(inserts.some((i) => i.table === "credit_ledger")).toBe(false)
  })

  it("rejects unknown price ids without credit mutation", async () => {
    const res = await POST(
      reqWithSig(
        paddleBody({ data: { id: "txn_01test12345678901234567890ad", status: "completed", customer_id: "ctm_01test", currency_code: "USD", custom_data: { user_id: USER_ID }, items: [{ price: { id: "pri_unknown_999" } }], details: { totals: { total: "4900", currency_code: "USD" } } } })
      )
    )
    expect(res.status).toBe(400)
    expect(inserts.some((i) => i.table === "credit_ledger")).toBe(false)
  })
})
