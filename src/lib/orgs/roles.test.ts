import { describe, it, expect } from "vitest"
import { canInvite, canManageBilling, canRemove, isOrgRole } from "./roles"

describe("organization role hierarchy", () => {
  it("recognizes only the four roles", () => {
    expect(isOrgRole("owner")).toBe(true)
    expect(isOrgRole("superadmin")).toBe(false)
    expect(isOrgRole(null)).toBe(false)
  })

  it("owners invite anyone but ownership; admins invite non-admins", () => {
    expect(canInvite("owner", "admin")).toBe(true)
    expect(canInvite("admin", "member")).toBe(true)
    expect(canInvite("admin", "admin")).toBe(false)
    expect(canInvite("member", "viewer")).toBe(false)
  })

  it("self-removal always allowed; owner removal is owner-only", () => {
    expect(canRemove("viewer", "viewer", true)).toBe(true)
    expect(canRemove("owner", "member", false)).toBe(true)
    expect(canRemove("admin", "member", false)).toBe(true)
    expect(canRemove("admin", "owner", false)).toBe(false)
    expect(canRemove("member", "viewer", false)).toBe(false)
  })

  it("only owners and admins touch billing", () => {
    expect(canManageBilling("owner")).toBe(true)
    expect(canManageBilling("admin")).toBe(false)
    expect(canManageBilling("member")).toBe(false)
  })
})
