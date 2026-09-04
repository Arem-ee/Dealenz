import { describe, it, expect } from "vitest"
import { resolveKnowledge } from "./resolver"
import { parseContextEnvelope } from "@/lib/context/schema"
import { parseKnowledgeItem } from "./schema"
import {
  TEST_STATUTE_A,
  TEST_GUIDANCE_B,
  TEST_PRACTICE_GLOBAL,
  TEST_DRAFT_C,
  testEnvelope,
} from "./fixtures"

const items = [
  parseKnowledgeItem(TEST_STATUTE_A),
  parseKnowledgeItem(TEST_GUIDANCE_B),
  parseKnowledgeItem(TEST_PRACTICE_GLOBAL),
  parseKnowledgeItem(TEST_DRAFT_C),
]
const envelope = parseContextEnvelope(testEnvelope())

describe("knowledge resolver", () => {
  it("returns structured candidates with relevance and reasons", () => {
    const candidates = resolveKnowledge(envelope, items, { asOf: "2026-09-04" })
    expect(candidates.length).toBeGreaterThan(0)
    for (const c of candidates) {
      expect(typeof c.knowledgeItemId).toBe("string")
      expect(typeof c.relevance).toBe("number")
      expect(c.relevance).toBeGreaterThanOrEqual(0)
      expect(c.relevance).toBeLessThanOrEqual(1)
      expect(c.applicabilityReasons.length).toBeGreaterThan(0)
    }
    // Sorted by relevance desc.
    for (let i = 1; i < candidates.length; i += 1) {
      expect(candidates[i - 1].relevance).toBeGreaterThanOrEqual(candidates[i].relevance)
    }
  })

  it("preserves authority on every candidate", () => {
    const candidates = resolveKnowledge(envelope, items, { asOf: "2026-09-04" })
    const byKey = new Map(candidates.map((c) => [c.itemKey, c]))
    expect(byKey.get("test-statute-a")?.authority).toBe("authoritative")
    expect(byKey.get("test-practice-global")?.authority).toBe("market_practice")
  })

  it("preserves provenance on every candidate", () => {
    const candidates = resolveKnowledge(envelope, items, { asOf: "2026-09-04" })
    const statute = candidates.find((c) => c.itemKey === "test-statute-a")
    expect(statute?.sourceName).toBe("synthetic-test-fixture")
    expect(statute?.sourceReference).toBe("TEST-STATUTE-A")
    expect(statute?.effectiveFrom).toBe("2021-06-01")
  })

  it("preserves applicability reasons per candidate", () => {
    const candidates = resolveKnowledge(envelope, items, { asOf: "2026-09-04" })
    const statute = candidates.find((c) => c.itemKey === "test-statute-a")
    expect(statute?.applicabilityReasons.join(" ")).toMatch(/Testlandia/)
  })

  it("returns an empty result for an empty store", () => {
    expect(resolveKnowledge(envelope, [], { asOf: "2026-09-04" })).toEqual([])
  })

  it("excludes unpublished knowledge by default", () => {
    const candidates = resolveKnowledge(envelope, items, { asOf: "2026-09-04" })
    expect(candidates.some((c) => c.itemKey === "test-draft-c")).toBe(false)
  })

  it("excludes expired items and handles superseded versions correctly", () => {
    // TEST_GUIDANCE_B expired 2023-12-31: absent now, present during its term.
    const now = resolveKnowledge(envelope, items, { asOf: "2026-09-04" })
    expect(now.some((c) => c.itemKey === "test-guidance-b")).toBe(false)
    const examplia = parseContextEnvelope(
      testEnvelope({
        fields: {
          ...(testEnvelope().fields as object),
          dealType: { value: "generic", source: "user_confirmed", confidence: 1 },
          jurisdiction: { value: "Examplia", source: "user_confirmed", confidence: 1 },
        },
      })
    )
    const then = resolveKnowledge(examplia, items, { asOf: "2023-06-15" })
    expect(then.some((c) => c.itemKey === "test-guidance-b")).toBe(true)

    // A superseded version stays recoverable via explicit status opt-in but
    // never leaks into default production resolution.
    const superseded = parseKnowledgeItem({ ...TEST_STATUTE_A, id: "test-old", version: 1, status: "superseded", supersededByVersion: 2 })
    const publishedV2 = parseKnowledgeItem({ ...TEST_STATUTE_A, id: "test-new", version: 2 })
    const lineage = [publishedV2, superseded]
    const withOld = resolveKnowledge(envelope, lineage, { asOf: "2026-09-04" })
    expect(withOld.filter((c) => c.itemKey === "test-statute-a").map((c) => c.version)).toEqual([2])
    const withHistory = resolveKnowledge(envelope, lineage, {
      asOf: "2026-09-04",
      includeStatuses: ["published", "superseded"],
    })
    expect(withHistory.filter((c) => c.itemKey === "test-statute-a").map((c) => c.version).sort()).toEqual([1, 2])
  })
})
