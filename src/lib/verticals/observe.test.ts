import { describe, it, expect } from "vitest"
import { corpusOf, findFirst, isNegated } from "./observe"

const extracted = {
  goals: [] as string[],
  deliverables: [] as string[],
  timeline: null,
  budget: "$2,400 per month",
  projectType: null,
  clientSignals: [] as string[],
  missingInformation: [] as string[],
  confidence: 0.9,
}

describe("observation helpers", () => {
  it("does not let negation bleed across corpus sections", () => {
    const corpus = corpusOf(extracted, "No subletting without consent.")
    const found = findFirst(corpus, /per month/i)
    expect(found?.text).toBe("per month")
    expect(isNegated(corpus, corpus.indexOf("per month"), "per month".length)).toBe(false)
  })

  it("still skips negated mentions within a section", () => {
    const corpus = corpusOf({ ...extracted, budget: null }, "No termination clause here.")
    expect(findFirst(corpus, /terminat/i)).toBeNull()
  })

  it("encodes no vertical assumptions: works on arbitrary non-deal text", () => {
    const corpus = corpusOf(
      { ...extracted, budget: null },
      "The quick brown fox jumps over the lazy dog. Nothing about agreements here."
    )
    expect(findFirst(corpus, /quick brown/i)?.text).toBe("quick brown")
    expect(findFirst(corpus, /rent|deposit|milestone|deliverable/i)).toBeNull()
    expect(corpus).not.toMatch(/freelance|lease|deal|contract/i)
  })
})
