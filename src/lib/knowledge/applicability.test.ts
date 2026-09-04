import { describe, it, expect } from "vitest"
import { evaluateApplicability, jurisdictionMatches } from "./applicability"
import { parseContextEnvelope } from "@/lib/context/schema"
import { parseKnowledgeItem } from "./schema"
import { TEST_STATUTE_A, TEST_PRACTICE_GLOBAL, testEnvelope } from "./fixtures"

const statute = parseKnowledgeItem(TEST_STATUTE_A)
const practice = parseKnowledgeItem(TEST_PRACTICE_GLOBAL)
const envelope = parseContextEnvelope(testEnvelope())

describe("applicability", () => {
  it("matches jurisdiction codes and global scope", () => {
    expect(jurisdictionMatches(statute, "Testlandia")).toBe(true)
    expect(jurisdictionMatches(statute, "testlandia")).toBe(true)
    expect(jurisdictionMatches(statute, "Examplia")).toBe(false)
    expect(jurisdictionMatches(statute, null)).toBe(false)
    expect(jurisdictionMatches(practice, null)).toBe(true)
    expect(jurisdictionMatches(practice, "Anywhere")).toBe(true)
  })

  it("rejects jurisdiction mismatch as ineligible", () => {
    const result = evaluateApplicability(statute, envelope)
    expect(result.eligible).toBe(true)
    const foreign = parseContextEnvelope(
      testEnvelope({ fields: { ...(testEnvelope().fields as object), jurisdiction: { value: "Examplia", source: "user_confirmed", confidence: 1 } } })
    )
    const mismatch = evaluateApplicability(statute, foreign)
    expect(mismatch.eligible).toBe(false)
    expect(mismatch.relevance).toBe(0)
    expect(mismatch.reasons.join(" ")).toMatch(/jurisdiction/)
  })

  it("matches deal type within scope", () => {
    const result = evaluateApplicability(statute, envelope)
    expect(result.eligible).toBe(true)
    expect(result.reasons.join(" ")).toMatch(/deal type freelance/)
  })

  it("rejects known deal-type mismatch", () => {
    const generic = parseContextEnvelope(
      testEnvelope({ fields: { ...(testEnvelope().fields as object), dealType: { value: "generic", source: "user_confirmed", confidence: 1 } } })
    )
    const narrow = parseKnowledgeItem({ ...TEST_PRACTICE_GLOBAL, applicability: { dealTypes: ["freelance"] } })
    const result = evaluateApplicability(narrow, generic)
    expect(result.eligible).toBe(false)
  })

  it("accumulates multiple contextual matches with reasons", () => {
    const result = evaluateApplicability(statute, envelope)
    expect(result.eligible).toBe(true)
    expect(result.relevance).toBeGreaterThan(0.4)
    expect(result.relevance).toBeLessThanOrEqual(1)
    // jurisdiction + deal type + industry = three match reasons.
    expect(result.reasons.length).toBeGreaterThanOrEqual(3)
  })

  it("marks unverified dimensions explicitly instead of disqualifying", () => {
    const sparse = parseContextEnvelope(
      testEnvelope({
        fields: {
          ...(testEnvelope().fields as object),
          industry: { value: null, source: "unknown", confidence: 0 },
          transactionStructure: { value: null, source: "unknown", confidence: 0 },
        },
      })
    )
    const result = evaluateApplicability(statute, sparse)
    expect(result.eligible).toBe(true)
    expect(result.reasons.join(" ")).toMatch(/not yet resolved/)
  })

  it("returns no match wording without legal conclusions", () => {
    const foreign = parseContextEnvelope(
      testEnvelope({ fields: { ...(testEnvelope().fields as object), jurisdiction: { value: "Examplia", source: "user_confirmed", confidence: 1 } } })
    )
    const result = evaluateApplicability(statute, foreign)
    const text = JSON.stringify(result)
    for (const banned of ["illegal", "enforceable", "definitely applies", "must comply"]) {
      expect(text).not.toContain(banned)
    }
  })
})
