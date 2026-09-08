import { describe, it, expect } from "vitest"
import { inspectEvidence, type SourceSnapshot } from "./inspect"
import { makeEvidence } from "./schema"

function auditEvidence(overrides: Record<string, unknown> = {}) {
  return makeEvidence({
    sourceType: "audit_input",
    sourceId: "audit-1",
    quote: "unlimited revisions until approval",
    observationKey: "facts.freelance.revisions",
    method: "pattern_observation",
    confidence: 0.8,
    inspectable: true,
    location: { kind: "approximate", section: "raw_input" },
    ...overrides,
  })
}

function snapshot(documents: Array<{ label: string; text: string }>): SourceSnapshot {
  return { auditId: "audit-1", documents }
}

describe("source inspection", () => {
  it("reports APPROXIMATE when the quote is found without exact offsets", () => {
    const result = inspectEvidence(
      auditEvidence(),
      snapshot([{ label: "Pasted input", text: "Scope: website.\nUnlimited revisions until approval, plus support." }])
    )
    expect(result.status).toBe("APPROXIMATE")
    expect(result.documentLabel).toBe("Pasted input")
    expect(result.locatedQuote).toBe("unlimited revisions until approval")
    expect(result.startOffset).toBeNull()
    expect(result.endOffset).toBeNull()
    expect(result.matchOffset).not.toBeNull()
  })

  it("matches across whitespace differences without claiming exactness", () => {
    const result = inspectEvidence(
      auditEvidence({ quote: "unlimited   revisions\nuntil approval" }),
      snapshot([{ label: "Pasted input", text: "Unlimited\trevisions until   approval." }])
    )
    expect(result.status).toBe("APPROXIMATE")
    expect(result.matchOffset).not.toBeNull()
  })

  it("reports UNAVAILABLE when the quote is no longer found", () => {
    const result = inspectEvidence(
      auditEvidence(),
      snapshot([{ label: "Pasted input", text: "Completely rewritten scope with capped revisions." }])
    )
    expect(result.status).toBe("UNAVAILABLE")
    expect(result.matchOffset).toBeNull()
    expect(result.documentLabel).toBeNull()
    expect(result.message).toMatch(/may have changed/)
  })

  it("reports UNAVAILABLE when no source documents exist", () => {
    const result = inspectEvidence(auditEvidence(), snapshot([]))
    expect(result.status).toBe("UNAVAILABLE")
    expect(result.message).toMatch(/no longer available/)
  })

  it("reports UNAVAILABLE for knowledge evidence without opening documents", () => {
    const knowledge = makeEvidence({
      sourceType: "knowledge",
      sourceId: "us-copyright-transfer-writing",
      sourceVersion: 1,
      quote: null,
      observationKey: "knowledge:us-copyright-transfer-writing",
      method: "knowledge_reference",
      confidence: 0.9,
      inspectable: true,
      location: { kind: "unavailable" },
    })
    const result = inspectEvidence(
      knowledge,
      snapshot([{ label: "Pasted input", text: "anything at all" }])
    )
    expect(result.status).toBe("UNAVAILABLE")
    expect(result.message).toMatch(/curated knowledge source/)
  })

  it("honors exact evidence only when offsets verify against the displayed text", () => {    const text = "Scope: website.\nUnlimited revisions until approval, plus support."
    const start = text.indexOf("Unlimited revisions until approval")
    const exact = makeEvidence({
      sourceType: "audit_input",
      sourceId: "audit-1",
      quote: "Unlimited revisions until approval",
      observationKey: "facts.freelance.revisions",
      method: "pattern_observation",
      confidence: 0.8,
      inspectable: true,
      location: { kind: "exact", startOffset: start, endOffset: start + "Unlimited revisions until approval".length },
    })
    const verified = inspectEvidence(exact, snapshot([{ label: "Pasted input", text }]))
    expect(verified.status).toBe("EXACT")
    expect(verified.startOffset).toBe(start)

    // Same claim against changed text must not render as exact.
    const stale = inspectEvidence(
      exact,
      snapshot([{ label: "Pasted input", text: "Scope: website.\nRevised terms apply." }])
    )
    expect(stale.status).toBe("UNAVAILABLE")
  })

  it("never upgrades approximate evidence even when offsets could be guessed", () => {
    const result = inspectEvidence(
      auditEvidence(),
      snapshot([{ label: "Pasted input", text: "Unlimited revisions until approval." }])
    )
    expect(result.status).toBe("APPROXIMATE")
    expect(result.startOffset).toBeNull()
    expect(result.endOffset).toBeNull()
  })

  it("searches every document and reports the first match", () => {
    const result = inspectEvidence(
      auditEvidence(),
      snapshot([
        { label: "Contract.pdf", text: "Unrelated terms." },
        { label: "Email thread", text: "Client wrote: unlimited revisions until approval, thanks." },
      ])
    )
    expect(result.status).toBe("APPROXIMATE")
    expect(result.documentLabel).toBe("Email thread")
  })
})
