import { describe, it, expect } from "vitest"
import { corpusOf, findFirst, isNegated, locateSectionRange, observePattern, sectionedParts } from "./observe"

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

  it("emits exact offsets for raw_input matches from an inspectable audit source", () => {
    const rawText = "Shop lease. Break clause with 30 days notice."
    const parts = sectionedParts(extracted, rawText)
    const observed = observePattern(parts, /break clause/i, {
      key: "facts.lease.termination",
      source: { type: "audit_input", id: "audit-1" },
    })
    expect(observed.text).toBe("Break clause")
    expect(observed.evidenceRefs).toHaveLength(1)
    const [evidence] = observed.evidenceRefs
    expect(evidence.location.kind).toBe("exact")
    expect(evidence.sourceId).toBe("audit-1")
    expect(evidence.inspectable).toBe(true)
    // Offsets are proven: they slice the original raw input back out.
    const start = (evidence.location as { startOffset: number }).startOffset
    const end = (evidence.location as { endOffset: number }).endOffset
    expect(rawText.slice(start, end)).toBe("Break clause")
    expect(evidence.quote).toBe("Break clause")
  })

  it("stays approximate for extraction-derived sections", () => {
    const parts = sectionedParts(extracted, "Some lease text.")
    const observed = observePattern(parts, /per month/i, {
      key: "facts.lease.rent",
      source: { type: "audit_input", id: "audit-1" },
    })
    expect(observed.text).toBe("per month")
    expect(observed.evidenceRefs[0].location.kind).toBe("approximate")
    expect(observed.evidenceRefs[0].location).toMatchObject({ section: "budget" })
    expect(observed.evidenceRefs[0]).not.toHaveProperty("startOffset")
  })

  it("stays approximate when the source cannot be inspected later", () => {
    const rawText = "Shop lease. Break clause with 30 days notice."
    const parts = sectionedParts(extracted, rawText)
    const observed = observePattern(parts, /break clause/i, {
      key: "facts.lease.termination",
      source: { type: "conversation_input", id: null },
    })
    expect(observed.evidenceRefs[0].location.kind).toBe("approximate")
    expect(observed.evidenceRefs[0].inspectable).toBe(false)
  })

  it("maps match indexes to section ranges", () => {
    const parts = sectionedParts(extracted, "Hello world")
    const range = locateSectionRange(parts, 2)
    expect(range?.section).toBe("raw_input")
    expect(range?.start).toBe(0)
    expect(locateSectionRange(parts, 10_000_000)).toBeNull()
  })
})
