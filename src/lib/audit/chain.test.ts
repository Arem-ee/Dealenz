import { describe, it, expect } from "vitest"
import { chainEntries, verifyChain } from "./chain"

describe("audit trail hash chain", () => {
  const rows = [
    { id: "a", createdAt: "2026-01-01T00:00:00Z", eventType: "created", payload: {} },
    { id: "b", createdAt: "2026-01-02T00:00:00Z", eventType: "signed", payload: { by: "x" } },
  ]

  it("chains deterministically and verifies", () => {
    const first = chainEntries(rows)
    const second = chainEntries(rows)
    expect(first.headHash).toBe(second.headHash)
    expect(first.entries).toHaveLength(2)
    expect(verifyChain(first.entries)).toBe(true)
  })

  it("detects tampering and gaps", () => {
    const { entries } = chainEntries(rows)
    const tampered = entries.map((e) => ({ ...e }))
    tampered[0]!.payload = { by: "mallory" }
    expect(verifyChain(tampered)).toBe(false)
    expect(verifyChain(entries.slice(1))).toBe(false)
  })

  it("handles the empty trail", () => {
    expect(chainEntries([])).toEqual({ entries: [], headHash: null })
    expect(verifyChain([])).toBe(true)
  })
})
