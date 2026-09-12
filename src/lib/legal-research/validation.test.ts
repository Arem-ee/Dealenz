import { describe, it, expect } from "vitest"
import { validateLegalSource, aggregateVeracity } from "./validation"
import type { LegalSource } from "./types"

function source(overrides: Partial<LegalSource> = {}): LegalSource {
  return {
    id: "ng-test",
    title: "Test CAMA",
    jurisdiction: { scope: "country", country: "Nigeria", region: null },
    authorityTier: 1,
    kind: "act",
    temporalStatus: "current",
    effectiveFrom: "2020-08-07",
    effectiveTo: null,
    sourceName: "CAMA 2020",
    sourceReference: "Section 18",
    sourceAuthority: "National Assembly (via PLAC)",
    publisher: "PLAC",
    originalUri: "https://placng.org/lawsofnigeria/laws/CAMA%202020.pdf",
    retrievedAt: new Date().toISOString(),
    citationText: "CAMA 2020, Section 18",
    content: "A company may be incorporated as a private company. This is the content with the excerpt inside. A company may be incorporated...",
    excerpt: "A company may be incorporated as a private company",
    contentHash: null,
    ...overrides,
  }
}

describe("validateLegalSource", () => {
  it("accepts a verified Nigerian Tier 1 source", () => {
    const r = validateLegalSource(source())
    expect(r.state).toBe("VERIFIED")
  })

  it("rejects non-allowlisted source as unverified", () => {
    const r = validateLegalSource(source({ originalUri: "https://evil.com/law.pdf" }))
    expect(r.state).toBe("UNVERIFIED")
  })

  it("rejects Tier 3 commentary as primary law", () => {
    const r = validateLegalSource(source({ originalUri: "https://randomblog.com/article", authorityTier: 1 }))
    // randomblog.com is Tier3, claimed 1 → unverified
    expect(r.state).toBe("UNVERIFIED")
  })

  it("rejects missing provenance", () => {
    const r = validateLegalSource(source({ sourceReference: "" }))
    expect(r.state).toBe("UNVERIFIED")
  })

  it("marks repealed as stale", () => {
    const r = validateLegalSource(source({ temporalStatus: "repealed" }))
    expect(r.state).toBe("STALE")
  })

  it("marks unsupported jurisdiction as unverified", () => {
    const r = validateLegalSource(source({ jurisdiction: { scope: "country", country: "Canada", region: null } }))
    expect(r.state).toBe("UNVERIFIED")
  })

  it("accepts a supported Tier 2 jurisdiction (Germany)", () => {
    const r = validateLegalSource(
      source({
        jurisdiction: { scope: "country", country: "Germany", region: null },
        originalUri: "https://www.gesetze-im-internet.de/bgb/",
      })
    )
    expect(r.state).toBe("VERIFIED")
  })

  it("marks stale when effective period ended or age >365d", () => {
    const old = new Date(Date.now() - 400 * 86400000).toISOString()
    const r = validateLegalSource(source({ retrievedAt: old }))
    expect(r.state).toBe("STALE")
  })

  it("marks excerpt mismatch as unverified (fabricated citation)", () => {
    const r = validateLegalSource(source({ excerpt: "This passage does not exist in the content at all and is much longer to ensure mismatch detection works properly with a fabricated long quote that cannot be found" }))
    expect(r.state).toBe("UNVERIFIED")
  })

  it("downgrades unknown temporal to SUPPORTED", () => {
    const r = validateLegalSource(source({ temporalStatus: "unknown" }))
    expect(r.state).toBe("SUPPORTED")
  })
})

describe("aggregateVeracity", () => {
  it("NOT_FOUND for empty", () => expect(aggregateVeracity([])).toBe("NOT_FOUND"))
  it("VERIFIED when all verified", () => expect(aggregateVeracity(["VERIFIED", "VERIFIED"])).toBe("VERIFIED"))
  it("CONFLICTING dominates", () => expect(aggregateVeracity(["VERIFIED", "CONFLICTING"])).toBe("CONFLICTING"))
  it("STALE dominates unverified", () => expect(aggregateVeracity(["VERIFIED", "STALE", "UNVERIFIED"])).toBe("STALE"))
})
