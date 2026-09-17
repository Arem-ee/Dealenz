import { describe, it, expect } from "vitest"
import { getAllDocumentsForAudit } from "./vault"
import { formatLegalCitation } from "@/lib/legal-research/format"
import { PRIMARY_NAV, SECONDARY_NAV, ACCOUNT_NAV } from "@/lib/nav"
import type { LegalCitation } from "@/lib/legal-research/types"

describe("app IA consolidation", () => {
  it("primary nav is Home, Vault, Settings with no secondary group", () => {
    expect(PRIMARY_NAV.map((n) => n.label)).toEqual(["Home", "Vault", "Settings"])
    expect(PRIMARY_NAV.map((n) => n.href)).toEqual(["/dashboard", "/vault", "/settings"])
    expect(SECONDARY_NAV).toEqual([])
    expect(ACCOUNT_NAV.map((n) => n.href)).toContain("/dashboard/activity")
  })

  it("vault selector orders source, drafts, risk, handoff over existing data only", () => {
    const full = getAllDocumentsForAudit({
      rawInput: "brief text",
      files: [{ name: "brief.pdf", size: 1024, type: "pdf", path: "p" }],
      documents: [{ id: "1", type: "proposal", title: "Proposal", content: "x", createdAt: new Date().toISOString() }],
      hasVersions: true,
      hasRiskSnapshot: true,
      hasHandoff: true,
    })
    expect(full.sections).toEqual(["source", "drafts", "risk", "handoff"])
    expect(full.draftCount).toBe(1)
    expect(full.fileCount).toBe(1)

    const empty = getAllDocumentsForAudit({
      rawInput: null,
      files: [],
      documents: [],
      hasVersions: false,
      hasRiskSnapshot: false,
      hasHandoff: false,
    })
    expect(empty.sections).toEqual([])
  })

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
