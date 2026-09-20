import { describe, it, expect, beforeEach } from "vitest"
import { clearPendingDeal, getPendingDeal, setPendingDeal } from "./pending-deal"

// Node has no sessionStorage: these exercise the in-memory fallback path.
// Browser persistence is a progressive enhancement over the same contract.

describe("pending deal text", () => {
  beforeEach(() => {
    clearPendingDeal()
  })

  it("round-trips typed text and clears it", () => {
    expect(getPendingDeal()).toBeNull()
    setPendingDeal("Client owes me $4,500.")
    expect(getPendingDeal()).toBe("Client owes me $4,500.")
    clearPendingDeal()
    expect(getPendingDeal()).toBeNull()
  })

  it("treats blank text as absent and caps length", () => {
    setPendingDeal("   ")
    expect(getPendingDeal()).toBeNull()
    setPendingDeal("x".repeat(30000))
    expect(getPendingDeal()?.length).toBe(20000)
    setPendingDeal(null)
    expect(getPendingDeal()).toBeNull()
  })
})
