import { describe, it, expect } from "vitest"
import {
  checkEvidence,
  evidenceId,
  makeEvidence,
  type Evidence,
} from "./schema"

function validEvidenceRaw() {
  return {
    id: "ev_12345678",
    sourceType: "audit_input",
    sourceId: "audit-1",
    sourceVersion: null,
    location: { kind: "approximate", section: "raw_input" },
    quote: "unlimited revisions until approval",
    observationKey: "facts.freelance.revisions",
    method: "pattern_observation",
    confidence: 0.8,
    inspectable: true,
  }
}

describe("evidence schema", () => {
  it("accepts valid evidence", () => {
    const evidence = checkEvidence(validEvidenceRaw())
    expect(evidence.id).toBe("ev_12345678")
    expect(evidence.location.kind).toBe("approximate")
  })

  it("rejects invalid source types", () => {
    expect(() => checkEvidence({ ...validEvidenceRaw(), sourceType: "vibes" })).toThrow(/source type/)
    expect(() => checkEvidence({ ...validEvidenceRaw(), sourceType: "document" })).toThrow(/source type/)
  })

  it("rejects invalid locations", () => {
    expect(() => checkEvidence({ ...validEvidenceRaw(), location: { kind: "nearby" } })).toThrow(/location/)
    // Offsets without exactness would fake precision.
    expect(() =>
      checkEvidence({ ...validEvidenceRaw(), location: { kind: "approximate", startOffset: 0, endOffset: 5 } })
    ).toThrow(/offsets/)
    expect(() =>
      checkEvidence({ ...validEvidenceRaw(), location: { kind: "exact", startOffset: 10, endOffset: 5 } })
    ).toThrow(/offsets/)
    expect(() =>
      checkEvidence({ ...validEvidenceRaw(), location: { kind: "exact", startOffset: 4, endOffset: 19 } })
    ).not.toThrow()
  })

  it("rejects invalid confidence values", () => {
    for (const confidence of [-0.1, 1.5, Number.NaN, "high"]) {
      expect(() => checkEvidence({ ...validEvidenceRaw(), confidence })).toThrow(/confidence/)
    }
    expect(() => checkEvidence({ ...validEvidenceRaw(), confidence: 0 })).not.toThrow()
    expect(() => checkEvidence({ ...validEvidenceRaw(), confidence: 1 })).not.toThrow()
  })

  it("rejects malformed ids and missing keys", () => {
    expect(() => checkEvidence({ ...validEvidenceRaw(), id: "" })).toThrow(/id/)
    expect(() => checkEvidence({ ...validEvidenceRaw(), id: 42 })).toThrow(/id/)
    expect(() => checkEvidence({ ...validEvidenceRaw(), observationKey: "  " })).toThrow(/observation key/)
    expect(() => checkEvidence(null)).toThrow()
    expect(() => checkEvidence([])).toThrow()
  })

  it("treats unknown state explicitly", () => {
    // No "unknown" source type, method, or location kind exists: callers
    // represent absence by omitting evidence, never by inventing a state.
    expect(() =>
      checkEvidence({ ...validEvidenceRaw(), method: "unknown" })
    ).toThrow(/observation method/)
  })

  it("builds deterministic ids from content", () => {
    const input = { source: "audit_input:a1", key: "facts.x", quote: "hello", location: "approximate:raw" }
    expect(evidenceId(input)).toBe(evidenceId(input))
    expect(evidenceId({ ...input, quote: "different" })).not.toBe(evidenceId(input))
    expect(evidenceId(input)).toMatch(/^ev_[0-9a-f]{8}$/)
  })

  it("makeEvidence validates and assigns deterministic ids", () => {
    const first = makeEvidence({
      sourceType: "audit_input",
      sourceId: "audit-1",
      quote: "unlimited revisions",
      observationKey: "facts.freelance.revisions",
      method: "pattern_observation",
      confidence: 0.8,
      inspectable: true,
      location: { kind: "approximate", section: "raw_input" },
    })
    const second = makeEvidence({
      sourceType: "audit_input",
      sourceId: "audit-1",
      quote: "unlimited revisions",
      observationKey: "facts.freelance.revisions",
      method: "pattern_observation",
      confidence: 0.8,
      inspectable: true,
      location: { kind: "approximate", section: "raw_input" },
    })
    expect(first.id).toBe(second.id)
    const parsed: Evidence = checkEvidence(JSON.parse(JSON.stringify(first)) as unknown)
    expect(parsed).toEqual(first)
    expect(() =>
      makeEvidence({
        sourceType: "audit_input",
        sourceId: null,
        quote: null,
        observationKey: "",
        method: "pattern_observation",
        confidence: 0.8,
        inspectable: false,
      })
    ).toThrow(/observation key/)
  })
})
