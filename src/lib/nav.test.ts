import { describe, it, expect } from "vitest"
import { PRIMARY_NAV, SECONDARY_NAV, ACCOUNT_NAV, isActiveEntry, titleFor } from "./nav"

describe("customer navigation IA (single source)", () => {
  it("keeps exactly five primary destinations: Home, Deals, Ask, Vault, Billing", () => {
    expect(PRIMARY_NAV.map((n) => n.label)).toEqual(["Home", "Deals", "Ask", "Vault", "Billing"])
    expect(PRIMARY_NAV.map((n) => n.href)).toEqual(["/dashboard", "/deals", "/ask", "/vault", "/billing"])
  })

  it("keeps secondary destinations out of primary navigation", () => {
    const primaryHrefs = new Set(PRIMARY_NAV.map((n) => n.href))
    for (const entry of [...SECONDARY_NAV, ...ACCOUNT_NAV]) {
      expect(primaryHrefs.has(entry.href)).toBe(false)
    }
    expect(SECONDARY_NAV).toEqual([])
  })

  it("matches nested routes to their entry without drift", () => {
    expect(isActiveEntry("/deals", "/deals")).toBe(true)
    expect(isActiveEntry("/audit/abc", "/audit/abc")).toBe(true)
    expect(isActiveEntry("/dashboard/settings", "/dashboard")).toBe(true)
    expect(isActiveEntry("/dashboard-settings", "/dashboard")).toBe(false)
    expect(isActiveEntry("/ask", "/deals")).toBe(false)
  })

  it("titles every role surface without exposing internals", () => {
    expect(titleFor("/dashboard")).toBe("Home")
    expect(titleFor("/audit/abc")).toBe("Deal")
    expect(titleFor("/ask")).toBe("Ask")
    expect(titleFor("/vault")).toBe("Vault")
    expect(titleFor("/billing")).toBe("Billing")
    expect(titleFor("/sign/token")).toBe("Signing")
    expect(titleFor("/admin/lawyers")).toBe("Control")
    expect(titleFor("/lawyer/reviews")).toBe("Lawyer workspace")
  })
})
