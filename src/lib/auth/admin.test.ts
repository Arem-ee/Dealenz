import { describe, it, expect } from "vitest"
import { isAdminSessionUser, isValidUUID } from "./admin"

describe("server-controlled admin authorization", () => {
  it("accepts a verified session with app_metadata is_admin", () => {
    expect(
      isAdminSessionUser({ id: "00000000-0000-0000-0000-000000000001", app_metadata: { is_admin: true } })
    ).toBe(true)
  })

  it("rejects ordinary users (no metadata at all)", () => {
    expect(isAdminSessionUser({ id: "00000000-0000-0000-0000-000000000001" })).toBe(false)
    expect(isAdminSessionUser({ id: "00000000-0000-0000-0000-000000000001", app_metadata: {} })).toBe(false)
    expect(isAdminSessionUser(null)).toBe(false)
    expect(isAdminSessionUser(undefined)).toBe(false)
  })

  it("rejects forged user_metadata is_admin (self-promotion attempt)", () => {
    // user_metadata is user-writable via auth.updateUser(); it must never
    // confer privilege even when it claims is_admin.
    const forged = {
      id: "00000000-0000-0000-0000-000000000001",
      app_metadata: {},
      user_metadata: { is_admin: true },
    } as never
    expect(isAdminSessionUser(forged)).toBe(false)
  })

  it("rejects non-boolean or falsy app_metadata flags", () => {
    expect(
      isAdminSessionUser({ id: "00000000-0000-0000-0000-000000000001", app_metadata: { is_admin: false } })
    ).toBe(false)
    expect(
      isAdminSessionUser({ id: "00000000-0000-0000-0000-000000000001", app_metadata: { is_admin: "true" } })
    ).toBe(false)
    expect(
      isAdminSessionUser({ id: "00000000-0000-0000-0000-000000000001", app_metadata: { is_admin: 1 } })
    ).toBe(false)
  })

  it("rejects malformed user ids even with the flag set", () => {
    expect(isAdminSessionUser({ id: "", app_metadata: { is_admin: true } })).toBe(false)
    expect(isAdminSessionUser({ id: "not-a-uuid", app_metadata: { is_admin: true } })).toBe(false)
    expect(isAdminSessionUser({ id: "00000000-0000-0000-0000-000000000001'; DROP TABLE users;--", app_metadata: { is_admin: true } })).toBe(false)
  })
})

describe("isValidUUID", () => {
  it("accepts canonical UUIDs and rejects everything else", () => {
    expect(isValidUUID("00000000-0000-0000-0000-000000000001")).toBe(true)
    expect(isValidUUID("A0B1C2D3-E4F5-6789-ABCD-EF0123456789")).toBe(true)
    expect(isValidUUID("")).toBe(false)
    expect(isValidUUID("short")).toBe(false)
    expect(isValidUUID(null)).toBe(false)
    expect(isValidUUID(undefined)).toBe(false)
    expect(isValidUUID(123)).toBe(false)
    expect(isValidUUID("00000000-0000-0000-0000-000000000001 ")).toBe(false)
  })
})
