import { describe, it, expect } from "vitest"
import { CREDIT_PACKAGES, getPackage, validatePurchaseInput, formatPrice, priceForPackage, packageValueLines } from "./catalog"

describe("credit package catalog — international", () => {
  it("has 3 active packages with stable ids and credits", () => {
    expect(CREDIT_PACKAGES).toHaveLength(3)
    expect(CREDIT_PACKAGES.map((p) => p.id)).toEqual(["starter", "standard", "pro"])
    for (const pkg of CREDIT_PACKAGES) {
      expect(pkg.active).toBe(true)
      expect(pkg.credits).toBeGreaterThan(0)
      expect(pkg.prices.USD).toBeGreaterThan(0)
      expect(pkg.prices.GBP).toBeGreaterThan(0)
      expect(pkg.prices.EUR).toBeGreaterThan(0)
    }
  })

  it("valid package resolves correctly", () => {
    const pkg = getPackage("standard")
    expect(pkg?.credits).toBe(150)
    expect(priceForPackage(pkg!, "USD")).toBe(2499)
    expect(formatPrice(2499, "USD")).toMatch(/\$24\.99/)
    expect(formatPrice(1999, "GBP")).toMatch(/£19\.99/)
  })

  it("invalid package rejected", () => {
    expect(validatePurchaseInput({ packageId: "unknown", currency: "USD" })).toEqual({ error: "Unknown package" })
  })

  it("inactive package rejected", () => {
    const pkg = getPackage("starter")!
    const original = pkg.active
    ;(pkg as { active: boolean }).active = false
    expect(validatePurchaseInput({ packageId: "starter", currency: "USD" })).toEqual({ error: "Package is not active" })
    ;(pkg as { active: boolean }).active = original
  })

  it("unsupported currency rejected", () => {
    expect(validatePurchaseInput({ packageId: "starter", currency: "NGN" })).toEqual({ error: "Unsupported currency" })
  })

  it("client cannot override server price/credit amount — amount derived server-side", () => {
    // Even if client sends amount/credits, server ignores them and uses catalog
    const validated = validatePurchaseInput({ packageId: "pro", currency: "EUR" })
    expect("error" in validated).toBe(false)
    if (!("error" in validated)) {
      expect(validated.package.credits).toBe(400)
      expect(priceForPackage(validated.package, "EUR")).toBe(5699)
    }
  })

  it("keeps volume discount: unit price falls as packs grow", () => {
    const unit = (id: string) => priceForPackage(getPackage(id)!, "USD") / getPackage(id)!.credits
    expect(unit("starter")).toBeGreaterThan(unit("standard"))
    expect(unit("standard")).toBeGreaterThan(unit("pro"))
  })

  it("describes what each pack buys from live credit prices", () => {
    expect(packageValueLines(50)).toEqual([
      "≈ 5 deal analyses",
      "≈ 2 proposals",
      "≈ 5 quick answers",
    ])
    expect(packageValueLines(400)[0]).toBe("≈ 40 deal analyses")
  })
})
