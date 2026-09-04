import { describe, it, expect } from "vitest"
import { isEffectiveAt, toISODate } from "./temporal"
import { TEST_STATUTE_A, TEST_GUIDANCE_B } from "./fixtures"
import { parseKnowledgeItem } from "./schema"

const statute = parseKnowledgeItem(TEST_STATUTE_A)
const guidance = parseKnowledgeItem(TEST_GUIDANCE_B)

describe("temporal applicability", () => {
  it("is false before the effective date", () => {
    expect(isEffectiveAt(statute, "2021-05-31")).toBe(false)
    expect(isEffectiveAt(statute, new Date("2021-05-31T00:00:00Z"))).toBe(false)
  })

  it("is true inside the effective period", () => {
    expect(isEffectiveAt(statute, "2021-06-01")).toBe(true)
    expect(isEffectiveAt(guidance, "2023-06-15")).toBe(true)
  })

  it("is false after expiry", () => {
    expect(isEffectiveAt(guidance, "2024-01-01")).toBe(false)
  })

  it("treats open-ended items as effective from effectiveFrom onward", () => {
    expect(isEffectiveAt(statute, "2030-01-01")).toBe(true)
    expect(toISODate(new Date("2026-09-04T12:00:00Z"))).toBe("2026-09-04")
  })
})
