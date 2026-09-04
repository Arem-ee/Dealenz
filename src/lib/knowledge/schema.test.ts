import { describe, it, expect } from "vitest"
import { parseKnowledgeItem } from "./schema"

function validItemRaw() {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    itemKey: "test-late-payment",
    version: 2,
    title: "Test late-payment interest note",
    kind: "market_practice",
    authority: "market_practice",
    jurisdiction: { scope: "global", code: null },
    provenance: {
      source: "synthetic-test-fixture",
      sourceReference: "TEST-REF-001",
      sourceAuthority: "test-suite",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      publisher: null,
      originalUri: null,
      checksum: null,
    },
    effectiveFrom: "2020-01-01",
    effectiveTo: null,
    status: "published",
    content: "Synthetic content. Not legal material.",
    applicability: { dealTypes: ["freelance"], industries: ["technology"] },
    supersededByVersion: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

describe("knowledge schema", () => {
  it("accepts a valid Knowledge Item", () => {
    const item = parseKnowledgeItem(validItemRaw())
    expect(item.itemKey).toBe("test-late-payment")
    expect(item.version).toBe(2)
    expect(item.authority).toBe("market_practice")
  })

  it("rejects invalid items", () => {
    expect(() => parseKnowledgeItem(null)).toThrow()
    expect(() => parseKnowledgeItem({ ...validItemRaw(), version: 0 })).toThrow(/version/)
    expect(() => parseKnowledgeItem({ ...validItemRaw(), title: "  " })).toThrow(/title/)
    expect(() => parseKnowledgeItem({ ...validItemRaw(), content: "" })).toThrow(/content/)
  })

  it("validates authority explicitly", () => {
    for (const authority of ["authoritative", "official_guidance", "secondary", "industry_practice", "market_practice"]) {
      expect(() => parseKnowledgeItem({ ...validItemRaw(), authority })).not.toThrow()
    }
    expect(() => parseKnowledgeItem({ ...validItemRaw(), authority: "supreme_truth" })).toThrow(/authority/)
    expect(() => parseKnowledgeItem({ ...validItemRaw(), authority: "law (definitely)" })).toThrow(/authority/)
  })

  it("validates jurisdiction scope and code rules", () => {
    expect(() =>
      parseKnowledgeItem({ ...validItemRaw(), jurisdiction: { scope: "global", code: "X" } })
    ).toThrow(/Global jurisdiction/)
    expect(() =>
      parseKnowledgeItem({ ...validItemRaw(), jurisdiction: { scope: "country", code: null } })
    ).toThrow(/jurisdiction code/)
    expect(() =>
      parseKnowledgeItem({ ...validItemRaw(), jurisdiction: { scope: "planet", code: null } })
    ).toThrow(/jurisdiction scope/)
    expect(() =>
      parseKnowledgeItem({
        ...validItemRaw(),
        jurisdiction: { scope: "country", code: "Testlandia" },
      })
    ).not.toThrow()
  })

  it("validates dates and rejects inverted ranges", () => {
    expect(() => parseKnowledgeItem({ ...validItemRaw(), effectiveFrom: "not-a-date" })).toThrow(/effectiveFrom/)
    expect(() => parseKnowledgeItem({ ...validItemRaw(), effectiveTo: "yesterday" })).toThrow(/effectiveTo/)
    expect(() =>
      parseKnowledgeItem({ ...validItemRaw(), effectiveFrom: "2022-01-01", effectiveTo: "2021-01-01" })
    ).toThrow(/precedes/)
    expect(() =>
      parseKnowledgeItem({ ...validItemRaw(), effectiveFrom: "2022-01-01", effectiveTo: "2022-01-01" })
    ).not.toThrow()
  })

  it("validates version numbering", () => {
    expect(() => parseKnowledgeItem({ ...validItemRaw(), version: 1.5 })).toThrow(/version/)
    expect(() => parseKnowledgeItem({ ...validItemRaw(), version: -2 })).toThrow(/version/)
  })

  it("validates status vocabulary", () => {
    for (const status of ["draft", "verified", "published", "superseded", "withdrawn"]) {
      const raw = { ...validItemRaw(), status, supersededByVersion: status === "superseded" ? 3 : null }
      if (status === "superseded") raw.version = 2
      expect(() => parseKnowledgeItem(raw)).not.toThrow()
    }
    expect(() => parseKnowledgeItem({ ...validItemRaw(), status: "live" })).toThrow(/status/)
    expect(() => parseKnowledgeItem({ ...validItemRaw(), supersededByVersion: 2 })).toThrow(/superseded/)
  })

  it("requires provenance and never fabricates it", () => {
    const raw = validItemRaw() as Record<string, unknown>
    const provenance = { ...(raw.provenance as Record<string, unknown>), sourceReference: "" }
    expect(() => parseKnowledgeItem({ ...raw, provenance })).toThrow(/source reference/)
    const noProvenance = { ...raw }
    delete (noProvenance as Record<string, unknown>).provenance
    expect(() => parseKnowledgeItem(noProvenance)).toThrow(/provenance/)
  })
})
