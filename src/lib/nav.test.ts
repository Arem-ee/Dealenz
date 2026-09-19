import { describe, it, expect } from "vitest"
import { PRIMARY_NAV, SECONDARY_NAV, ACCOUNT_NAV, isActiveEntry, titleFor, backTargetFor } from "./nav"

describe("customer navigation IA (single source)", () => {
  it("keeps exactly two primary destinations: Home and Library", () => {
    expect(PRIMARY_NAV.map((n) => n.label)).toEqual(["Home", "Library"])
    expect(PRIMARY_NAV.map((n) => n.href)).toEqual(["/dashboard", "/library"])
  })

  it("keeps secondary destinations out of primary navigation", () => {
    const primaryHrefs = new Set(PRIMARY_NAV.map((n) => n.href))
    for (const entry of [...SECONDARY_NAV, ...ACCOUNT_NAV]) {
      expect(primaryHrefs.has(entry.href)).toBe(false)
    }
    expect(SECONDARY_NAV).toEqual([])
  })

  it("keeps account destinations in the account menu, never primary", () => {
    expect(ACCOUNT_NAV.map((n) => n.href)).toEqual(["/settings", "/billing", "/help"])
  })

  it("matches nested routes to their entry without drift", () => {
    expect(isActiveEntry("/library", "/library")).toBe(true)
    expect(isActiveEntry("/audit/abc", "/audit/abc")).toBe(true)
    expect(isActiveEntry("/dashboard/settings", "/dashboard")).toBe(true)
    expect(isActiveEntry("/dashboard-settings", "/dashboard")).toBe(false)
    expect(isActiveEntry("/chat/abc", "/library")).toBe(false)
  })

  it("titles every role surface without exposing internals", () => {
    expect(titleFor("/dashboard")).toBe("Home")
    expect(titleFor("/audit/abc")).toBe("Deal")
    expect(titleFor("/chat/abc")).toBe("Chat")
    expect(titleFor("/vault")).toBe("Library")
    expect(titleFor("/library")).toBe("Library")
    expect(titleFor("/settings")).toBe("Settings")
    expect(titleFor("/billing")).toBe("Billing")
    expect(titleFor("/help")).toBe("Get help")
    expect(titleFor("/sign/token")).toBe("Signing")
    expect(titleFor("/admin/lawyers")).toBe("Control")
    expect(titleFor("/lawyer/reviews")).toBe("Lawyer workspace")
  })

  it("shows the shell back control only on thread views", () => {
    expect(backTargetFor("/chat/abc-123")).toBe("/dashboard")
    expect(backTargetFor("/dashboard")).toBeNull()
    expect(backTargetFor("/library")).toBeNull()
    expect(backTargetFor("/settings")).toBeNull()
    expect(backTargetFor("/chat")).toBeNull()
    // Document Reader and Review carry their own thread-aware back links.
    expect(backTargetFor("/document/abc")).toBeNull()
    expect(backTargetFor("/review/abc")).toBeNull()
  })
})
