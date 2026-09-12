import { describe, it, expect } from "vitest"
import { VERTICAL_TIER, tierForDealType, isPrimaryBusinessOwnerDealType } from "./tier"
import { verticalForDealType, registeredVerticalKeys } from "./index"

describe("business-owner priority tiers (Phase 27)", () => {
  it("founder and partnership are tier 1 (primary)", () => {
    expect(VERTICAL_TIER.founder).toBe(1)
    expect(VERTICAL_TIER.partnership).toBe(1)
    expect(isPrimaryBusinessOwnerDealType("founder")).toBe(true)
    expect(isPrimaryBusinessOwnerDealType("partnership")).toBe(true)
  })

  it("purchase_sale, lease, employment are tier 2", () => {
    expect(VERTICAL_TIER.purchase_sale).toBe(2)
    expect(VERTICAL_TIER.lease).toBe(2)
    expect(VERTICAL_TIER.employment).toBe(2)
  })

  it("freelance is tier 3 (supported, not canonical)", () => {
    expect(VERTICAL_TIER.freelance).toBe(3)
    expect(isPrimaryBusinessOwnerDealType("freelance")).toBe(false)
  })

  it("generic is tier 4 fallback", () => {
    expect(VERTICAL_TIER.generic).toBe(4)
  })

  it("every registered vertical has a tier", () => {
    for (const k of registeredVerticalKeys()) {
      expect(tierForDealType(k)).not.toBeNull()
    }
    expect(tierForDealType("unknown")).toBeNull()
  })

  it("dispatcher still resolves all verticals including Tier 1", () => {
    expect(verticalForDealType("founder")?.key).toBe("founder")
    expect(verticalForDealType("partnership")?.key).toBe("partnership")
    expect(verticalForDealType("freelance")?.key).toBe("freelance")
  })
})
