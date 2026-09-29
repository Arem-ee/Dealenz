import { describe, it, expect } from "vitest"
import { NextRequest } from "next/server"
import { isScimAuthorized, parseScimActive, parseScimUser, scimTokenConfigured } from "./scim"

function authed(token: string | null): NextRequest {
  return new NextRequest("http://localhost/api/scim/users", token ? { headers: { authorization: `Bearer ${token}` } } : undefined)
}

describe("SCIM-lite auth", () => {
  it("fails closed without a configured token", () => {
    const prev = process.env.SCIM_PROVISION_TOKEN
    delete process.env.SCIM_PROVISION_TOKEN
    expect(scimTokenConfigured()).toBe(false)
    expect(isScimAuthorized(authed("anything"))).toBe(false)
    process.env.SCIM_PROVISION_TOKEN = prev
  })

  it("accepts the exact token and rejects near-misses", () => {
    const prev = process.env.SCIM_PROVISION_TOKEN
    process.env.SCIM_PROVISION_TOKEN = "a".repeat(32)
    expect(isScimAuthorized(authed("a".repeat(32)))).toBe(true)
    expect(isScimAuthorized(authed("a".repeat(31) + "b"))).toBe(false)
    expect(isScimAuthorized(authed(null))).toBe(false)
    expect(isScimAuthorized(authed("short"))).toBe(false)
    process.env.SCIM_PROVISION_TOKEN = prev
  })

  it("rejects short configured tokens", () => {
    const prev = process.env.SCIM_PROVISION_TOKEN
    process.env.SCIM_PROVISION_TOKEN = "short"
    expect(scimTokenConfigured()).toBe(false)
    expect(isScimAuthorized(authed("short"))).toBe(false)
    process.env.SCIM_PROVISION_TOKEN = prev
  })
})

describe("SCIM user parsing", () => {
  it("accepts userName, email, and SCIM email arrays", () => {
    expect(parseScimUser({ userName: "Ada@Acme.COM " })).toEqual({
      ok: true,
      user: { email: "ada@acme.com", active: true, displayName: null },
    })
    expect(parseScimUser({ emails: [{ value: "bob@acme.com", primary: true }], name: { formatted: "Bob" } })).toEqual({
      ok: true,
      user: { email: "bob@acme.com", active: true, displayName: "Bob" },
    })
  })

  it("rejects missing and malformed emails", () => {
    expect(parseScimUser({})).toEqual({ ok: false, error: expect.any(String) })
    expect(parseScimUser({ userName: "not-an-email" })).toEqual({ ok: false, error: expect.any(String) })
    expect(parseScimUser(null)).toEqual({ ok: false, error: expect.any(String) })
  })

  it("parses active flags and SCIM patch operations", () => {
    expect(parseScimActive({ active: false })).toEqual({ ok: true, active: false })
    expect(parseScimActive({ Operations: [{ op: "Replace", path: "active", value: true }] })).toEqual({
      ok: true,
      active: true,
    })
    expect(parseScimActive({})).toEqual({ ok: false, error: expect.any(String) })
  })
})
