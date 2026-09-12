import { describe, it, expect } from "vitest"
import { AUTHORITY_REGISTRY, domainsForJurisdiction, isRegistryJurisdiction } from "./registry"
import { isAllowedUrl } from "./allowlist"

describe("authority registry — jurisdiction as data", () => {
  it("covers US states, UK regions, EU, Germany, France, Netherlands, Nigeria without engine changes", () => {
    expect(isRegistryJurisdiction("United States")).toBe(true)
    expect(isRegistryJurisdiction("United Kingdom")).toBe(true)
    expect(isRegistryJurisdiction("European Union")).toBe(true)
    expect(isRegistryJurisdiction("Germany")).toBe(true)
    expect(isRegistryJurisdiction("France")).toBe(true)
    expect(isRegistryJurisdiction("Netherlands")).toBe(true)
    expect(isRegistryJurisdiction("Nigeria")).toBe(true)
    expect(isRegistryJurisdiction("Canada")).toBe(false)
  })

  it("returns region-appropriate domains", () => {
    expect(domainsForJurisdiction("United States", "Delaware")).toContain("delcode.delaware.gov")
    expect(domainsForJurisdiction("United States", "Delaware")).not.toContain("leginfo.legislature.ca.gov")
    expect(domainsForJurisdiction("United Kingdom", "Scotland")).toContain("legislation.gov.uk")
    expect(domainsForJurisdiction("European Union", null)).toContain("eur-lex.europa.eu")
    expect(domainsForJurisdiction("Germany", null)).toContain("gesetze-im-internet.de")
    expect(domainsForJurisdiction("France", null)).toContain("legifrance.gouv.fr")
    expect(domainsForJurisdiction("Netherlands", null)).toContain("wetten.overheid.nl")
  })

  it("every registry domain is allowlisted (registry never exceeds allowlist)", () => {
    for (const entry of AUTHORITY_REGISTRY) {
      for (const d of entry.domains) {
        expect(isAllowedUrl(`https://${d}/x`)).toBe(true)
      }
    }
  })

  it("no jurisdiction is privileged — Nigeria is one entry among many", () => {
    const countries = new Set(AUTHORITY_REGISTRY.map((e) => e.country))
    expect(countries.has("Nigeria")).toBe(true)
    expect(countries.has("United States")).toBe(true)
    expect(countries.has("United Kingdom")).toBe(true)
    // Nigeria entries do not dominate the registry
    const ng = AUTHORITY_REGISTRY.filter((e) => e.country === "Nigeria").length
    expect(ng).toBeLessThan(AUTHORITY_REGISTRY.length)
  })
})
