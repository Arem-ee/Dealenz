import { describe, expect, it } from "vitest"
import { locateSpan, splitSentences } from "./locate"

const DOC = "Payment Terms. The Client shall pay all invoices within thirty (30) days of receipt. Late payments accrue interest. Termination. Either party may terminate with fourteen days notice."

describe("locateSpan", () => {
  it("locates verbatim quotes EXACT with correct offsets", () => {
    const out = locateSpan(DOC, "Either party may terminate with fourteen days notice.")
    expect(out.kind).toBe("EXACT")
    if (out.kind === "EXACT") {
      expect(DOC.slice(out.startOffset, out.endOffset)).toBe("Either party may terminate with fourteen days notice.")
    }
  })

  it("collapses whitespace for EXACT matches", () => {
    const messy = "Pay   net\nthirty   days."
    const out = locateSpan(messy, "Pay net thirty days.")
    expect(out.kind).toBe("EXACT")
    if (out.kind === "EXACT") {
      expect(messy.slice(out.startOffset, out.endOffset)).toBe("Pay   net\nthirty   days.")
    }
  })

  it("grades near-verbatim variants APPROXIMATE with a score", () => {
    const out = locateSpan(DOC, "The Client shall pay all invoices within thirty days of receipt.")
    expect(out.kind).toBe("APPROXIMATE")
    if (out.kind === "APPROXIMATE") {
      expect(out.score).toBeGreaterThanOrEqual(0.5)
      expect(DOC.slice(out.startOffset, out.endOffset)).toContain("thirty (30) days")
    }
  })

  it("holds distant paraphrases below threshold (UNAVAILABLE, honestly)", () => {
    const out = locateSpan(DOC, "The client must pay every invoice within 30 days after receiving them.")
    expect(out.kind).toBe("UNAVAILABLE")
  })

  it("returns UNAVAILABLE for unrelated quotes", () => {
    expect(locateSpan(DOC, "Quantum entanglement violates local realism.").kind).toBe("UNAVAILABLE")
    expect(locateSpan("", "anything").kind).toBe("UNAVAILABLE")
    expect(locateSpan(DOC, "   ").kind).toBe("UNAVAILABLE")
  })

  it("never returns offsets outside the document", () => {
    const out = locateSpan(DOC, "Late payments accrue interest.")
    if (out.kind !== "UNAVAILABLE") {
      expect(out.startOffset).toBeGreaterThanOrEqual(0)
      expect(out.endOffset).toBeLessThanOrEqual(DOC.length)
      expect(out.endOffset).toBeGreaterThan(out.startOffset)
    }
  })
})

describe("splitSentences", () => {
  it("keeps offsets aligned to the original", () => {
    for (const s of splitSentences(DOC)) {
      expect(DOC.slice(s.startOffset, s.endOffset)).toContain(s.text.trim().slice(0, 10))
    }
  })
})
