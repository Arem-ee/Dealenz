import { describe, it, expect } from "vitest"
import {
  US_TIER2_CORPUS,
  UK_TIER2_CORPUS,
  EU_TIER2_CORPUS,
  DE_CORPUS,
  FR_CORPUS,
  NL_CORPUS,
  INTERNATIONAL_LEGAL_CORPUS,
} from "./corpus"
import { validateLegalSource } from "./validation"
import { isAllowedUrl } from "./allowlist"

const ALL_TIER2 = [...US_TIER2_CORPUS, ...UK_TIER2_CORPUS, ...EU_TIER2_CORPUS, ...DE_CORPUS, ...FR_CORPUS, ...NL_CORPUS]

describe("Tier 2 legal corpus (purchase_sale / lease / employment)", () => {
  it("covers purchase_sale, lease, and employment topics for US and UK", () => {
    const usIds = US_TIER2_CORPUS.map((s) => s.id)
    expect(usIds).toContain("us-ucc-article2-sale")
    expect(usIds).toContain("us-ca-civil-tenancy")
    expect(usIds).toContain("us-flsa-wages")
    const ukIds = UK_TIER2_CORPUS.map((s) => s.id)
    expect(ukIds).toContain("uk-sale-goods-1979")
    expect(ukIds).toContain("uk-landlord-tenant-1954")
    expect(ukIds).toContain("uk-employment-rights-1996")
    expect(EU_TIER2_CORPUS.map((s) => s.id)).toContain("eu-sale-goods-directive-2019-771")
    expect(DE_CORPUS.map((s) => s.id)).toContain("de-bgb-contracts")
    expect(FR_CORPUS.map((s) => s.id)).toContain("fr-code-civil-contracts")
    expect(NL_CORPUS.map((s) => s.id)).toContain("nl-bw-contracts")
  })

  it("every Tier 2 item validates as VERIFIED or SUPPORTED with honest provenance", () => {
    for (const src of ALL_TIER2) {
      expect(isAllowedUrl(src.originalUri!)).toBe(true)
      expect(src.authorityTier).toBe(1)
      expect(src.kind).toBe("act")
      expect(src.content).not.toMatch(/FAIL|ruleKey/i)
      expect(src.excerpt.trim().length).toBeGreaterThanOrEqual(20)
      expect(src.content).toContain(src.excerpt.trim().slice(0, 40))
      const v = validateLegalSource(src)
      expect(["VERIFIED", "SUPPORTED"]).toContain(v.state)
    }
  })

  it("Tier 2 items are jurisdiction-scoped (no global law, no Nigeria leakage)", () => {
    for (const src of ALL_TIER2) {
      expect(src.jurisdiction.country).not.toBe("Nigeria")
      expect(src.jurisdiction.country).not.toBe("UNKNOWN")
    }
    expect(US_TIER2_CORPUS.every((s) => s.jurisdiction.country === "United States")).toBe(true)
    expect(UK_TIER2_CORPUS.every((s) => s.jurisdiction.country === "United Kingdom")).toBe(true)
    expect(EU_TIER2_CORPUS.every((s) => s.jurisdiction.country === "European Union")).toBe(true)
    // US tenancy source is state-scoped (California), not federal
    const ca = US_TIER2_CORPUS.find((s) => s.id === "us-ca-civil-tenancy")!
    expect(ca.jurisdiction.region).toBe("California")
  })

  it("no duplicate ids across the international corpus", () => {
    const ids = INTERNATIONAL_LEGAL_CORPUS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
