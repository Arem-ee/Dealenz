import { describe, it, expect } from "vitest"
import { parseSsoDomain, ssoErrorMessage } from "./sso"

describe("enterprise SSO input handling", () => {
  it("parses bare domains and full emails to a domain", () => {
    expect(parseSsoDomain("acme.com")).toBe("acme.com")
    expect(parseSsoDomain("  Ada@Acme.COM ")).toBe("acme.com")
    expect(parseSsoDomain("corp.example.co.uk")).toBe("corp.example.co.uk")
  })

  it("rejects blanks and malformed domains", () => {
    expect(parseSsoDomain("")).toBeNull()
    expect(parseSsoDomain("   ")).toBeNull()
    expect(parseSsoDomain("not a domain")).toBeNull()
    expect(parseSsoDomain("acme")).toBeNull()
    expect(parseSsoDomain("@")).toBeNull()
  })

  it("maps unconfigured domains to an honest message", () => {
    expect(ssoErrorMessage("SSO identity provider not found")).toContain("isn't set up")
    expect(ssoErrorMessage("SAML response invalid")).toContain("identity provider")
    expect(ssoErrorMessage("network timeout")).toBe("We couldn't start SSO sign-in. Please try again.")
    expect(ssoErrorMessage("")).toBe("We couldn't start SSO sign-in. Please try again.")
  })
})
