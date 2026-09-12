import { describe, it, expect } from "vitest"
import { DOCUMENT_FAMILIES, familiesForDealType, familyById } from "./families"

describe("document families — international, jurisdiction-neutral", () => {
  it("founder has founder families and partnership has partnership families", () => {
    const founder = familiesForDealType("founder")
    expect(founder.length).toBeGreaterThanOrEqual(2)
    expect(founder.every((f) => f.dealTypes.includes("founder"))).toBe(true)
    const partnership = familiesForDealType("partnership")
    expect(partnership.length).toBeGreaterThanOrEqual(2)
    expect(partnership.every((f) => f.dealTypes.includes("partnership"))).toBe(true)
  })

  it("no family is Nigeria-specific — families are jurisdiction-neutral", () => {
    for (const family of DOCUMENT_FAMILIES) {
      expect(family.title.toLowerCase()).not.toMatch(/nigeria/)
      expect(family.description.toLowerCase()).not.toMatch(/nigeria.*only/)
      // Legal context is separate, not hardcoded into family identity
      expect(family.legalContextIds.length).toBeGreaterThan(0)
    }
  })

  it("familyById resolves and has required fields", () => {
    const f = familyById("founder-agreement")
    expect(f).not.toBeNull()
    expect(f!.requiredJurisdiction).toBe(true)
    expect(f!.clauseIds.length).toBeGreaterThan(0)
    expect(familyById("nonexistent")).toBeNull()
  })

  it("freelance and generic have no business-owner families; Tier 2 has term sheets", () => {
    expect(familiesForDealType("freelance").some((f) => f.id === "founder-agreement")).toBe(false)
    expect(familiesForDealType("purchase_sale").some((f) => f.id === "purchase-terms-sheet")).toBe(true)
    expect(familiesForDealType("lease").some((f) => f.id === "lease-terms-summary")).toBe(true)
    expect(familiesForDealType("employment").some((f) => f.id === "employment-terms-summary")).toBe(true)
    expect(familiesForDealType("generic").length).toBe(0)
  })
})
