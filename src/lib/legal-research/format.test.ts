import { describe, it, expect } from "vitest"
import { formatLegalCitation } from "./format"
import type { LegalCitation } from "./types"

describe("formatLegalCitation", () => {
  it("formats a legal citation in the shared Ask shape", () => {
    const citation: LegalCitation = {
      sourceId: "ng-cac-1",
      title: "CAMA 2020",
      section: "s140",
      url: "https://example.com/cama#s140",
      passage: "restricted transfer",
      retrievedAt: "2026-09-01T00:00:00.000Z",
      effectiveStatus: "current",
      jurisdiction: "Nigeria",
      authorityTier: 1,
    }
    expect(formatLegalCitation(citation)).toBe(
      'CAMA 2020 — s140: "restricted transfer" [https://example.com/cama#s140] · Nigeria · Tier 1 · current · retrieved 2026-09-01'
    )
  })
})
