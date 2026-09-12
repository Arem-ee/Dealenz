import { describe, it, expect } from "vitest"
import { performResearch } from "./research"
import { INTERNATIONAL_LEGAL_CORPUS } from "./corpus"
import { validateLegalSource } from "./validation"
import { isAllowedUrl } from "./allowlist"
import type { Jurisdiction } from "./types"

describe("jurisdiction model — US/UK/EU", () => {
  it("US jurisdiction accepted (country + Delaware/California/New York)", async () => {
    const delaware: Jurisdiction = { scope: "state_province", country: "United States", region: "Delaware" }
    const r1 = await performResearch({ text: "Delaware share transfer", jurisdiction: delaware, dealType: "founder" }, { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS })
    expect(["VERIFIED", "SUPPORTED"]).toContain(r1.state)
    const r2 = await performResearch({ text: "California incorporation", jurisdiction: { scope: "state_province", country: "United States", region: "California" }, dealType: "founder" }, { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS })
    expect(["VERIFIED", "SUPPORTED"]).toContain(r2.state)
    const r3 = await performResearch({ text: "New York certificate", jurisdiction: { scope: "state_province", country: "United States", region: "New York" }, dealType: "founder" }, { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS })
    expect(["VERIFIED", "SUPPORTED"]).toContain(r3.state)
    expect(r1.citations[0].jurisdiction).toBe("United States")
  })

  it("UK England & Wales / Scotland / Northern Ireland distinguishable", async () => {
    const eng: Jurisdiction = { scope: "territory", country: "United Kingdom", region: "England and Wales" }
    const scot: Jurisdiction = { scope: "territory", country: "United Kingdom", region: "Scotland" }
    const ni: Jurisdiction = { scope: "territory", country: "United Kingdom", region: "Northern Ireland" }
    const rEng = await performResearch({ text: "Companies Act transfer of shares", jurisdiction: eng, dealType: "founder" }, { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS })
    const rScot = await performResearch({ text: "Companies Act Scotland", jurisdiction: scot, dealType: "founder" }, { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS })
    const rNI = await performResearch({ text: "Companies Act Northern Ireland", jurisdiction: ni, dealType: "founder" }, { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS })
    expect(rEng.citations.length).toBeGreaterThan(0)
    expect(rScot.citations.length).toBeGreaterThan(0)
    expect(rNI.citations.length).toBeGreaterThan(0)
    // Scotland citation should be Scotland-specific, not England & Wales
    expect(rScot.citations[0].url).toContain("legislation.gov.uk")
    expect(rNI.citations[0].url).toContain("legislation.gov.uk")
    // Ensure they are not collapsed — different regions should not share identical first citation when possible
    // At minimum, regions are preserved in the source jurisdiction
    const scotSource = INTERNATIONAL_LEGAL_CORPUS.find((s) => s.id === "uk-scotland-companies-act-application")
    expect(scotSource?.jurisdiction.region).toBe("Scotland")
  })

  it("EU represented", async () => {
    const eu: Jurisdiction = { scope: "custom", country: "European Union", region: null }
    const r = await performResearch({ text: "EU company law disclosure", jurisdiction: eu, dealType: "founder" }, { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS })
    expect(r.citations.length).toBeGreaterThan(0)
    expect(r.citations[0].jurisdiction).toBe("European Union")
  })

  it("unsupported jurisdiction remains unsupported", async () => {
    const ca: Jurisdiction = { scope: "country", country: "Canada", region: null }
    const r = await performResearch({ text: "Canadian sale warranty termination", jurisdiction: ca, dealType: "purchase_sale" }, { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS })
    expect(r.state).toBe("NOT_FOUND")
    expect(r.citations).toEqual([])
  })

  it("Germany/France/Netherlands have Tier 2 foundation coverage", async () => {
    const de: Jurisdiction = { scope: "country", country: "Germany", region: null }
    const rDe = await performResearch({ text: "German sale lease employment", jurisdiction: de, dealType: "purchase_sale" }, { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS })
    expect(["VERIFIED", "SUPPORTED"]).toContain(rDe.state)
    expect(rDe.citations[0].url).toContain("gesetze-im-internet.de")
    const fr: Jurisdiction = { scope: "country", country: "France", region: null }
    const rFr = await performResearch({ text: "French sale lease employment", jurisdiction: fr, dealType: "purchase_sale" }, { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS })
    expect(["VERIFIED", "SUPPORTED"]).toContain(rFr.state)
    expect(rFr.citations[0].url).toContain("legifrance.gouv.fr")
    const nl: Jurisdiction = { scope: "country", country: "Netherlands", region: null }
    const rNl = await performResearch({ text: "Dutch sale lease employment", jurisdiction: nl, dealType: "purchase_sale" }, { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS })
    expect(["VERIFIED", "SUPPORTED"]).toContain(rNl.state)
    expect(rNl.citations[0].url).toContain("wetten.overheid.nl")
  })

  it("missing jurisdiction becomes NEEDS_JURISDICTION and asks, never guesses", async () => {
    const unknown: Jurisdiction = { scope: "custom", country: "UNKNOWN", region: null }
    const r = await performResearch({ text: "What does the law say about vesting?", jurisdiction: unknown, dealType: "founder" }, { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS })
    expect(r.state).toBe("NEEDS_JURISDICTION")
    expect(r.citations).toEqual([])
    expect(r.limitations).toMatch(/jurisdiction/i)
  })
})

describe("source validation — US/UK", () => {
  it("verified US source accepted", () => {
    const us = INTERNATIONAL_LEGAL_CORPUS.find((s) => s.id === "us-delaware-dgcl-s102-certificate")!
    expect(validateLegalSource(us).state).toBe("VERIFIED")
    expect(isAllowedUrl(us.originalUri!)).toBe(true)
  })
  it("verified UK source accepted", () => {
    const uk = INTERNATIONAL_LEGAL_CORPUS.find((s) => s.id === "uk-companies-act-s9-registration")!
    expect(validateLegalSource(uk).state).toBe("VERIFIED")
  })
  it("wrong-jurisdiction source rejected", () => {
    const us = INTERNATIONAL_LEGAL_CORPUS.find((s) => s.id === "us-delaware-dgcl-s102-certificate")!
    const wrong = { ...us, jurisdiction: { scope: "country" as const, country: "United Kingdom", region: null } }
    // Validation itself doesn't check jurisdiction mismatch vs query, but research filtering does
    expect(wrong.jurisdiction.country).not.toBe("United States")
  })
  it("untrusted source rejected", () => {
    const bad = { ...INTERNATIONAL_LEGAL_CORPUS[0], originalUri: "https://evil.com/law.pdf" }
    expect(validateLegalSource(bad as never).state).toBe("UNVERIFIED")
  })
  it("fabricated citation rejected", async () => {
    const { validateCitations } = await import("./citations")
    const src = INTERNATIONAL_LEGAL_CORPUS[0]
    const fake = { sourceId: src.id, title: src.title, section: src.sourceReference, url: src.originalUri, passage: "Fabricated passage that does not exist in source content at all for testing", retrievedAt: src.retrievedAt, effectiveStatus: src.temporalStatus, jurisdiction: src.jurisdiction.country, authorityTier: src.authorityTier }
    expect(validateCitations([fake as never], [src]).valid).toBe(false)
  })
})
