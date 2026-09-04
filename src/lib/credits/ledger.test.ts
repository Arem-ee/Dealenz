import { describe, it, expect, vi } from "vitest"
import {
  finalizeReservation,
  getCreditBalance,
  reserveCredits,
  voidReservation,
  type LedgerClient,
} from "./ledger"

function rpcClient(handler: (fn: string, args: Record<string, unknown>) => unknown): LedgerClient {
  return { rpc: vi.fn(async (fn: string, args: Record<string, unknown> = {}) => ({ data: handler(fn, args), error: null })) }
}

describe("credit ledger client", () => {
  it("reads the derived balance and rejects malformed responses", async () => {
    const client = rpcClient(() => [{ balance: 42 }])
    await expect(getCreditBalance(client)).resolves.toBe(42)
    const bad = rpcClient(() => [{ balance: "lots" }])
    await expect(getCreditBalance(bad)).rejects.toThrow(/balance/)
    const failing = { rpc: vi.fn(async () => ({ data: null, error: { message: "db down" } })) } as LedgerClient
    await expect(getCreditBalance(failing)).rejects.toThrow()
  })

  it("validates reservations before any RPC", async () => {
    const calls: string[] = []
    const client = rpcClient((fn) => { calls.push(fn); return [{ allowed: true, balance: 1, reservation_id: "r" }] })
    await expect(reserveCredits(client, { operation: "conversation", amount: 0, idempotencyKey: "k" })).rejects.toThrow(/positive/)
    await expect(reserveCredits(client, { operation: "conversation", amount: 5, idempotencyKey: "" })).rejects.toThrow(/idempotency/)
    expect(calls).toHaveLength(0)
  })

  it("returns allowance, balance, and reservation id", async () => {
    const client = rpcClient(() => [{ allowed: true, balance: 90, reservation_id: "res-1" }])
    const result = await reserveCredits(client, { operation: "conversation", amount: 10, idempotencyKey: "q-1" })
    expect(result).toEqual({ allowed: true, balance: 90, reservationId: "res-1" })
  })

  it("finalizes with measured consumption and validates amounts", async () => {
    const seen: unknown[] = []
    const client = rpcClient((fn, args) => { seen.push({ fn, args }); return [{ balance: 87 }] })
    await expect(
      finalizeReservation(client, { reservationId: "res-1", consumptionAmount: 3, operation: "conversation" })
    ).resolves.toEqual({ balance: 87 })
    await expect(
      finalizeReservation(client, { reservationId: "res-1", consumptionAmount: -1, operation: "conversation" })
    ).rejects.toThrow(/non-negative/)
    expect(seen).toHaveLength(1)
  })

  it("propagates void failures instead of hiding them", async () => {
    const failing = { rpc: vi.fn(async () => ({ data: null, error: { message: "db down" } })) } as LedgerClient
    await expect(voidReservation(failing, "res-1")).rejects.toThrow()
  })
})
