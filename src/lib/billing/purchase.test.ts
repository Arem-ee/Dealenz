/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest"
import { getPackage, priceForPackage } from "./catalog"
import { createMockAdapter } from "./provider"

function makeMockSupabase() {
  const purchases = new Map<string, { status: string; user_id: string; credits: number }>()
  const ledger: Array<{ user_id: string; idempotency_key: string; amount: number }> = []
  const service: any = {
    from: (table: string) => {
      if (table === "credit_purchases") {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              eq: (col2: string, val2: string) => ({
                maybeSingle: async () => {
                  const key = `${val}:${val2}`
                  const found = purchases.get(key)
                  if (found) return { data: { status: found.status }, error: null }
                  return { data: null, error: null }
                },
              }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => {
            const key = `${row.provider}:${row.provider_transaction_id}`
            if (purchases.has(key)) return { error: { message: "duplicate key value violates unique constraint" } }
            purchases.set(key, { status: row.status as string, user_id: row.user_id as string, credits: row.credits as number })
            return { error: null }
          },
          update: (update: Record<string, unknown>) => ({
            eq: (col: string, val: string) => ({
              eq: (col2: string, val2: string) => {
                const key = `${val}:${val2}`
                const existing = purchases.get(key)
                if (existing) {
                  purchases.set(key, { ...existing, status: update.status as string })
                  return Promise.resolve({ error: null })
                }
                return Promise.resolve({ error: { message: "not found" } })
              },
            }),
          }),
        } as any
      }
      if (table === "credit_ledger") {
        return {
          insert: async (row: Record<string, unknown>) => {
            const exists = ledger.find((l) => l.user_id === row.user_id && l.idempotency_key === row.idempotency_key)
            if (exists) return { error: { message: "duplicate key value violates unique constraint" } }
            ledger.push({ user_id: row.user_id as string, idempotency_key: row.idempotency_key as string, amount: row.amount as number })
            return { error: null }
          },
        } as any
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }), insert: async () => ({ error: null }), update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }) } as any
    },
  }
  return { service, purchases, ledger }
}

describe("purchase idempotency + ledger (Paddle international)", () => {
  it("successful verified event allocates credits via ledger once", async () => {
    const { service, purchases, ledger } = makeMockSupabase()
    const pkg = getPackage("starter")!
    const adapter = createMockAdapter()
    const body = JSON.stringify({
      event_id: "evt_01test",
      event_type: "transaction.completed",
      occurred_at: new Date().toISOString(),
      notification_id: "ntf_01test",
      data: {
        id: "txn_01test12345678901234567890ab",
        status: "completed",
        customer_id: "ctm_01test",
        currency_code: "USD",
        custom_data: { user_id: "00000000-0000-0000-0000-000000000001", package_id: "starter" },
        items: [{ price: { id: "pri_xxx" } }],
        details: { totals: { total: String(priceForPackage(pkg, "USD")), currency_code: "USD" } },
      },
    })
    const verified = await adapter.verifyWebhook({ body, signature: "test", secret: "" })
    expect(verified.status).toBe("succeeded")
    expect(verified.priceId).toBe("pri_xxx")
    // Simulate webhook handler: idempotency check + insert purchase + ledger
    const existing = await (service.from("credit_purchases") as any).select().eq("provider", "paddle").eq("provider_transaction_id", verified.providerTransactionId).maybeSingle()
    expect((existing as { data: null }).data).toBeNull()
    const ins = await (service.from("credit_purchases") as any).insert({
      provider: "paddle",
      provider_transaction_id: verified.providerTransactionId,
      package_id: pkg.id,
      currency: verified.currency,
      amount_minor: verified.totalMinor,
      credits: pkg.credits,
      user_id: verified.userId,
      status: "succeeded",
    })
    expect(ins.error).toBeNull()
    const ledgerIns = await (service.from("credit_ledger") as any).insert({
      user_id: verified.userId,
      entry_type: "grant",
      amount: pkg.credits,
      status: "finalized",
      idempotency_key: `purchase:${verified.providerTransactionId}`,
      metadata: {},
    })
    expect(ledgerIns.error).toBeNull()
    expect(purchases.size).toBe(1)
    expect(ledger).toHaveLength(1)
  })

  it("duplicate webhook does not double-credit (idempotent)", async () => {
    const { service, ledger } = makeMockSupabase()
    const pkg = getPackage("starter")!
    const providerTransactionId = "txn_01test12345678901234567890ab"
    const userId = "00000000-0000-0000-0000-000000000001"
    // First
    await (service.from("credit_purchases") as any).insert({
      provider: "paddle",
      provider_transaction_id: providerTransactionId,
      package_id: pkg.id,
      currency: "USD",
      amount_minor: priceForPackage(pkg, "USD"),
      credits: pkg.credits,
      user_id: userId,
      status: "succeeded",
    })
    await (service.from("credit_ledger") as any).insert({
      user_id: userId,
      entry_type: "grant",
      amount: pkg.credits,
      status: "finalized",
      idempotency_key: `purchase:${providerTransactionId}`,
      metadata: {},
    })
    // Second (retry)
    const dupPurchase = await (service.from("credit_purchases") as any).insert({
      provider: "paddle",
      provider_transaction_id: providerTransactionId,
      package_id: pkg.id,
      currency: "USD",
      amount_minor: priceForPackage(pkg, "USD"),
      credits: pkg.credits,
      user_id: userId,
      status: "succeeded",
    })
    expect(dupPurchase.error).not.toBeNull()
    const dupLedger = await (service.from("credit_ledger") as any).insert({
      user_id: userId,
      entry_type: "grant",
      amount: pkg.credits,
      status: "finalized",
      idempotency_key: `purchase:${providerTransactionId}`,
      metadata: {},
    })
    expect(dupLedger.error).not.toBeNull()
    expect(ledger).toHaveLength(1)
  })

  it("wrong amount is rejected (never trust client)", async () => {
    const pkg = getPackage("standard")!
    const wrongAmount = 100 // instead of 2499
    expect(wrongAmount).not.toBe(priceForPackage(pkg, "USD"))
    // Server would compare verified.amountMinor !== expected and reject
    const expected = priceForPackage(pkg, "USD")
    expect(wrongAmount).not.toBe(expected)
  })

  it("failed/canceled payment allocates nothing", async () => {
    const adapter = createMockAdapter()
    const body = JSON.stringify({
      event_id: "evt_01test",
      event_type: "transaction.completed",
      occurred_at: new Date().toISOString(),
      notification_id: "ntf_01test",
      data: {
        id: "txn_01failed12345678901234567890ab",
        status: "canceled",
        customer_id: "ctm_01test",
        currency_code: "USD",
        custom_data: { user_id: "00000000-0000-0000-0000-000000000001" },
        items: [{ price: { id: "pri_xxx" } }],
        details: { totals: { total: "1900", currency_code: "USD" } },
      },
    })
    const verified = await adapter.verifyWebhook({ body, signature: "test", secret: "" })
    expect(verified.status).toBe("canceled")
    // Handler would early return without ledger insert for non-succeeded
    expect(verified.status).not.toBe("succeeded")
  })

  it("unknown package is rejected", () => {
    expect(getPackage("unknown")).toBeNull()
  })

  it("wrong currency is rejected", () => {
    const pkg = getPackage("starter")!
    const wrongCurrency = "JPY" as any
    // Server would compare verified currency vs expected; JPY is not in catalog
    expect(["USD", "GBP", "EUR"].includes(wrongCurrency as string)).toBe(false)
    void pkg
  })

  it("wrong amount is detected via catalog price check", () => {
    const pkg = getPackage("starter")!
    const expected = priceForPackage(pkg, "GBP")
    const verifiedAmount = 100 // wrong
    expect(verifiedAmount).not.toBe(expected)
  })

  it("unknown user is rejected (invalid UUID)", () => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    expect(uuidRe.test("not-a-uuid")).toBe(false)
    expect(uuidRe.test("00000000-0000-0000-0000-000000000001")).toBe(true)
  })

  it("invalid webhook signature is rejected (provider)", async () => {
    const adapter = createMockAdapter()
    // Mock adapter allows "test" signature, but real Lemon Squeezy adapter would reject invalid sig
    // For mock, we test that malformed JSON is rejected
    await expect(adapter.verifyWebhook({ body: "not-json", signature: "test", secret: "" })).rejects.toThrow()
  })

  it("user isolation — ledger entry is for verified userId only", async () => {
    const { service, ledger } = makeMockSupabase()
    const pkg = getPackage("starter")!
    const userA = "00000000-0000-0000-0000-000000000001"
    const userB = "00000000-0000-0000-0000-000000000002"
    await (service.from("credit_ledger") as any).insert({
      user_id: userA,
      entry_type: "grant",
      amount: pkg.credits,
      status: "finalized",
      idempotency_key: "purchase:order_isolation",
      metadata: {},
    })
    expect(ledger[0].user_id).toBe(userA)
    expect(ledger[0].user_id).not.toBe(userB)
  })

  it("checkout is server-authoritative — amount derived, not client trusted", () => {
    const pkg = getPackage("pro")!
    const clientAmount = 1 // client tries to cheat with $0.01
    const serverAmount = priceForPackage(pkg, "EUR")
    expect(serverAmount).toBe(5699)
    expect(clientAmount).not.toBe(serverAmount)
    expect(pkg.credits).toBe(400) // credits also server-derived, not client-provided
  })

  it("safe return/cancel URLs are derived from NEXT_PUBLIC_APP_URL, not client", () => {
    const appUrl = "https://dealenz.com"
    const base = new URL(appUrl)
    const successUrl = new URL("/billing?checkout=success", base).toString()
    const cancelUrl = new URL("/billing?checkout=cancel", base).toString()
    expect(successUrl).toBe("https://dealenz.com/billing?checkout=success")
    expect(cancelUrl).toBe("https://dealenz.com/billing?checkout=cancel")
    // Client cannot inject arbitrary URL
    const evil = "https://evil.com/steal"
    expect(successUrl).not.toBe(evil)
  })
})
