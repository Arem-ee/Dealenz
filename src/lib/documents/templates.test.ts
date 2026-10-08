import { describe, expect, it } from "vitest"
import { defaultDealTypeForFamily, listTemplateOptions } from "./templates"

describe("listTemplateOptions", () => {
  it("returns the full catalog without a filter", () => {
    const all = listTemplateOptions()
    expect(all.length).toBeGreaterThan(0)
    expect(all[0]).toHaveProperty("id")
    expect(all[0]).toHaveProperty("title")
  })

  it("filters by deal-type label", () => {
    const founder = listTemplateOptions("Founder")
    expect(founder.length).toBeGreaterThan(0)
    expect(founder.every((t) => t.dealType === "founder")).toBe(true)
  })

  it("returns empty for an unknown label", () => {
    expect(listTemplateOptions("Nonexistent")).toEqual([])
  })
})

describe("defaultDealTypeForFamily", () => {
  it("resolves the primary deal type", () => {
    expect(defaultDealTypeForFamily("founder-agreement")).toBe("founder")
    expect(defaultDealTypeForFamily("purchase-terms-sheet")).toBe("purchase_sale")
  })

  it("returns null for unknown families", () => {
    expect(defaultDealTypeForFamily("nope")).toBeNull()
  })
})
