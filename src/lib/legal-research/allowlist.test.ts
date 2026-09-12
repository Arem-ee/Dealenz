import { describe, it, expect } from "vitest"
import { isAllowedUrl, authorityTierForUrl } from "./allowlist"

describe("legal-research allowlist", () => {
  it("allows Tier 1 Nigerian official domains", () => {
    expect(isAllowedUrl("https://cac.gov.ng/resources/")).toBe(true)
    expect(isAllowedUrl("https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf")).toBe(true)
    expect(isAllowedUrl("https://lawsofnigeria.placng.org/laws/CAMA%202020.pdf")).toBe(true)
    expect(isAllowedUrl("https://nass.gov.ng/document/download/123")).toBe(true)
  })

  it("allows subdomains of allowlisted hosts", () => {
    expect(isAllowedUrl("https://www.cac.gov.ng/search")).toBe(true)
  })

  it("rejects non-allowlisted, private, and malicious URLs", () => {
    expect(isAllowedUrl("https://evil.com/malware")).toBe(false)
    expect(isAllowedUrl("https://cac.gov.ng.evil.com/")).toBe(false)
    expect(isAllowedUrl("http://localhost/admin")).toBe(false)
    expect(isAllowedUrl("http://127.0.0.1:3000")).toBe(false)
    expect(isAllowedUrl("http://10.0.0.1/internal")).toBe(false)
    expect(isAllowedUrl("javascript:alert(1)")).toBe(false)
    expect(isAllowedUrl("data:text/html,hi")).toBe(false)
    expect(isAllowedUrl("https://cac.gov.ng:80@evil.com/")).toBe(false)
  })

  it("classifies authority tier correctly", () => {
    expect(authorityTierForUrl("https://cac.gov.ng/")).toBe(1)
    expect(authorityTierForUrl("https://nigerialii.org/akn/ng/act/2020/cama")).toBe(2)
    expect(authorityTierForUrl("https://randomblog.com/nigeria-law")).toBe(3)
  })
})
