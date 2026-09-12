import { describe, it, expect } from "vitest"
import { assembleDraft } from "./assembly"
import { familiesForDealType } from "./families"

describe("Tier 2 document assembly (term sheets, jurisdiction-aware)", () => {
  it("assembles a US purchase terms sheet with verified UCC citations", () => {
    const result = assembleDraft(
      {
        familyId: "purchase-terms-sheet",
        dealType: "purchase_sale",
        jurisdiction: { country: "United States", region: null },
        findings: [],
        variables: { purchase_price: "50,000", currency: "USD", payment_timing: "on delivery" },
        partnershipStructure: null,
      },
      new Date()
    )
    expect(result.veracity).toBe("VERIFIED")
    expect(result.citations.length).toBeGreaterThan(0)
    expect(result.citations.every((c) => c.jurisdiction === "United States")).toBe(true)
    expect(result.draft.markdown).toContain("Purchase Terms Sheet")
    expect(result.draft.markdown).toContain("50,000")
    // Unprovided variables stay UNKNOWN
    expect(result.missingVariables.length).toBeGreaterThan(0)
    expect(result.draft.markdown).toMatch(/\{\{\w+\}\}/)
    // Term sheets are not agreements, so a VERIFIED term sheet does not force
    // review (the draft still carries the drafting-assistance lawyer notice)
    expect(result.requiresLawyerReview).toBe(false)
    expect(result.draft.markdown).toContain("drafting assistance")
  })

  it("assembles a UK employment summary with verified ERA citations", () => {
    const result = assembleDraft(
      {
        familyId: "employment-terms-summary",
        dealType: "employment",
        jurisdiction: { country: "United Kingdom", region: "England and Wales" },
        findings: [],
        variables: {},
        partnershipStructure: null,
      },
      new Date()
    )
    expect(result.veracity).toBe("VERIFIED")
    expect(result.citations.every((c) => c.jurisdiction === "United Kingdom")).toBe(true)
    expect(result.draft.markdown).toContain("Employment Terms Summary")
  })

  it("Testland lease summary is honest: no citations, fixture notice, never Nigerian law", () => {
    const result = assembleDraft(
      {
        familyId: "lease-terms-summary",
        dealType: "lease",
        jurisdiction: { country: "Testland", region: null },
        findings: [],
        variables: {},
        partnershipStructure: null,
      },
      new Date()
    )
    expect(result.veracity).toBe("NOT_FOUND")
    expect(result.citations).toEqual([])
    expect(result.draft.markdown).toContain("Testland is a synthetic fixture")
    // No Nigerian law leaks: no CAMA citations or Nigerian authority URLs
    // (the fixture notice itself names Nigeria only to disclaim it)
    expect(result.draft.markdown).not.toMatch(/CAMA 2020|placng\.org|cac\.gov\.ng/)
  })

  it("unsupported jurisdiction yields an honest draft without citations", () => {
    const result = assembleDraft(
      {
        familyId: "purchase-terms-sheet",
        dealType: "purchase_sale",
        jurisdiction: { country: "Canada", region: null },
        findings: [],
        variables: {},
        partnershipStructure: null,
      },
      new Date()
    )
    expect(result.veracity).toBe("NOT_FOUND")
    expect(result.citations).toEqual([])
    expect(result.draft.markdown).toContain("No verified legal sources were available for Canada")
  })

  it("Tier 2 families exist per deal type and stay jurisdiction-neutral", () => {
    expect(familiesForDealType("purchase_sale").map((f) => f.id)).toContain("purchase-terms-sheet")
    expect(familiesForDealType("lease").map((f) => f.id)).toContain("lease-terms-summary")
    expect(familiesForDealType("employment").map((f) => f.id)).toContain("employment-terms-summary")
    for (const f of [...familiesForDealType("purchase_sale"), ...familiesForDealType("lease"), ...familiesForDealType("employment")]) {
      expect(f.title.toLowerCase()).not.toMatch(/nigeria/)
      expect(f.requiredJurisdiction).toBe(true)
    }
    // Freelance and generic still have no business-owner families
    expect(familiesForDealType("freelance").some((f) => f.id === "purchase-terms-sheet")).toBe(false)
    expect(familiesForDealType("generic").length).toBe(0)
  })
})
