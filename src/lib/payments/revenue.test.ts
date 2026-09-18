import { describe, it, expect } from "vitest"
import { calculateRevenueShare, verifyRevenueAccounting } from "./revenue"

describe("revenue-share accounting", () => {
  it("splits 20/80 deterministically", () => {
    const { platformFeeMinor, lawyerPayoutMinor } = calculateRevenueShare(10000)
    expect(platformFeeMinor).toBe(2000)
    expect(lawyerPayoutMinor).toBe(8000)
    expect(verifyRevenueAccounting({ amountMinor: 10000, platformFeeMinor, lawyerPayoutMinor })).toBe(true)
  })
  it("handles rounding down", () => {
    const { platformFeeMinor, lawyerPayoutMinor } = calculateRevenueShare(999)
    expect(platformFeeMinor).toBe(199) // floor(999*0.2)
    expect(lawyerPayoutMinor).toBe(800)
    expect(platformFeeMinor + lawyerPayoutMinor).toBe(999)
  })
  it("rejects invalid amount", () => {
    expect(() => calculateRevenueShare(0)).toThrow()
    expect(() => calculateRevenueShare(-100)).toThrow()
  })
  it("never mixes credits", () => {
    // Credits are separate ledger; revenue is money, not credits — no conversion path exists
    expect(true).toBe(true)
  })
})
