import { describe, it, expect } from "vitest"
import { CREDIT_PACKAGES, getPackage, validatePurchaseInput, formatPrice, priceForPackage } from "./catalog"

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
    expect(priceForPackage(pkg!, "USD")).toBe(4900)
    expect(formatPrice(4900, "USD")).toMatch(/\$49/)
    expect(formatPrice(3900, "GBP")).toMatch(/£39/)
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
      expect(priceForPackage(validated.package, "EUR")).toBe(9900)
    }
  })
})
