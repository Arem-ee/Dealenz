import { describe, expect, it } from "vitest"
import { audienceLabel, guestPortalPath, isGuestAudience, isGuestScope, normalizeGuestEmail } from "./grants"

describe("guest grant validation", () => {
  it("accepts the three audiences and two scopes", () => {
    expect(isGuestAudience("supplier")).toBe(true)
    expect(isGuestAudience("partner")).toBe(false)
    expect(isGuestScope("uploader")).toBe(true)
    expect(isGuestScope("admin")).toBe(false)
  })

  it("normalizes emails strictly", () => {
    expect(normalizeGuestEmail("  Counsel@Vendor.CO ")).toBe("counsel@vendor.co")
    expect(normalizeGuestEmail("not-an-email")).toBeNull()
    expect(normalizeGuestEmail("")).toBeNull()
  })

  it("labels audiences and builds portal paths", () => {
    expect(audienceLabel("customer")).toBe("Customer")
    expect(guestPortalPath("abc")).toBe("/guest/abc")
  })
})
