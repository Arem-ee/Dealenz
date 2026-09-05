import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { FREELANCE_CORPUS } from "./corpus"
import { parseKnowledgeItem } from "./schema"
import { evaluateApplicability } from "./applicability"
import { parseContextEnvelope } from "@/lib/context/schema"
import { applyUserConfirmation, seedEnvelopeForDealType } from "@/lib/context"

function asFullItem(seed: (typeof FREELANCE_CORPUS)[number], index: number) {
  return parseKnowledgeItem({
    id: `00000000-0000-0000-0000-00000000000${index + 1}`,
    itemKey: seed.itemKey,
    version: 1,
    title: seed.title,
    kind: seed.kind,
    authority: seed.authority,
    jurisdiction: { scope: seed.jurisdictionScope, code: seed.jurisdictionCode },
    provenance: {
      source: seed.source,
      sourceReference: seed.sourceReference,
      sourceAuthority: seed.sourceAuthority,
      retrievedAt: seed.retrievedAt,
      publisher: seed.publisher,
      originalUri: seed.originalUri,
      checksum: null,
    },
    effectiveFrom: seed.effectiveFrom,
    effectiveTo: seed.effectiveTo,
    status: seed.status,
    content: seed.content,
    applicability: seed.applicability,
    supersededByVersion: null,
    createdAt: "2026-09-04T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
  })
}

describe("production corpus", () => {
  it("contains a small set of fully valid items", () => {
    expect(FREELANCE_CORPUS.length).toBeGreaterThanOrEqual(2)
    expect(FREELANCE_CORPUS.length).toBeLessThanOrEqual(6)
    for (const [index, seed] of FREELANCE_CORPUS.entries()) {
      const item = asFullItem(seed, index)
      expect(item.status).toBe("published")
      expect(item.version).toBe(1)
    }
  })

  it("contains no synthetic fixtures or fabricated provenance", () => {
    const serialized = JSON.stringify(FREELANCE_CORPUS)
    for (const banned of ["TEST-", "Testlandia", "Examplia", "synthetic-test-fixture", "test-suite"]) {
      expect(serialized).not.toContain(banned)
    }
    for (const seed of FREELANCE_CORPUS) {
      expect(seed.originalUri).toMatch(/^https:\/\//)
      expect(seed.sourceReference.trim().length).toBeGreaterThan(0)
    }
  })

  it("mirrors migration 00026 exactly by key and count", () => {
    const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "00026_freelance_knowledge_seed.sql"), "utf8")
    expect(sql).toMatch(/ON CONFLICT \(item_key, version\) DO NOTHING/)
    for (const seed of FREELANCE_CORPUS) {
      expect(sql).toContain(`'${seed.itemKey}'`)
    }
    const seedCount = (sql.match(/^\(\s*$/gm) ?? []).length
    expect(seedCount).toBe(FREELANCE_CORPUS.length)
  })

  it("does not match an unknown jurisdiction to a country-scoped item", () => {
    const envelope = parseContextEnvelope(seedEnvelopeForDealType("freelance"))
    const usItem = asFullItem(FREELANCE_CORPUS[0], 0)
    expect(usItem.jurisdiction.scope).toBe("country")
    const result = evaluateApplicability(usItem, envelope)
    expect(result.eligible).toBe(false)
  })

  it("matches a confirmed jurisdiction to its statute", () => {
    const envelope = parseContextEnvelope(
      applyUserConfirmation(seedEnvelopeForDealType("freelance"), {
        jurisdiction: { value: "United States" },
      })
    )
    const usItem = asFullItem(FREELANCE_CORPUS[0], 0)
    const result = evaluateApplicability(usItem, envelope)
    expect(result.eligible).toBe(true)
    expect(result.reasons.join(" ")).toMatch(/United States/)
  })
})
