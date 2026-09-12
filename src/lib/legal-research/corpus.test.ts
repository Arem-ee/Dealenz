import { describe, it, expect } from "vitest"
import { NIGERIA_FOUNDER_CORPUS, NIGERIA_PARTNERSHIP_CORPUS, NIGERIA_LEGAL_CORPUS } from "./corpus"
import { validateLegalSource } from "./validation"

describe("Nigeria founder/partnership legal corpora", () => {
  it("founder corpus covers the deterministic rule topics without duplicating rule output", () => {
    const ids = NIGERIA_FOUNDER_CORPUS.map((s) => s.id)
    expect(ids).toContain("ng-cama-s18-types-of-companies")
    expect(ids).toContain("ng-cama-s140-transfer-of-shares")
    expect(ids).toContain("ng-cama-s240-directors-duties")
    expect(NIGERIA_FOUNDER_CORPUS.length).toBeGreaterThanOrEqual(5)
    for (const src of NIGERIA_FOUNDER_CORPUS) {
      expect(src.jurisdiction.country).toBe("Nigeria")
      expect(src.authorityTier).toBe(1)
      expect(src.originalUri).toMatch(/^https:\/\//)
      expect(["act", "official_guidance"]).toContain(src.kind)
      // No rule-like "FAIL" language — knowledge explains, rules determine
      expect(src.content).not.toMatch(/FAIL|ruleKey/i)
    }
  })

  it("partnership corpus distinguishes LLPs, LPs, and ordinary partnerships from companies", () => {
    expect(NIGERIA_PARTNERSHIP_CORPUS.length).toBeGreaterThanOrEqual(4)
    const content = NIGERIA_PARTNERSHIP_CORPUS.map((s) => s.content).join(" ")
    expect(content).toMatch(/LLP/i)
    expect(content).toMatch(/partnership/i)
    expect(content).not.toMatch(/collapses? LLPs.*into one concept/i)
  })

  it("every corpus item passes validation as VERIFIED or SUPPORTED (allowlisted, Nigerian, current)", () => {
    for (const src of NIGERIA_LEGAL_CORPUS) {
      const v = validateLegalSource(src)
      expect(["VERIFIED", "SUPPORTED"]).toContain(v.state)
    }
  })

  it("corpora are distinct but share no duplicate ids", () => {
    const all = [...NIGERIA_FOUNDER_CORPUS, ...NIGERIA_PARTNERSHIP_CORPUS]
    const ids = all.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Cross-vehicle nuance: founder items about companies, partnership about LLPs
    expect(NIGERIA_FOUNDER_CORPUS.some((s) => s.title.toLowerCase().includes("company"))).toBe(true)
    expect(NIGERIA_PARTNERSHIP_CORPUS.some((s) => s.title.toLowerCase().includes("llp") || s.title.toLowerCase().includes("partnership"))).toBe(true)
  })
})
