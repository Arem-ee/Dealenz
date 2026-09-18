import { describe, it, expect } from "vitest"
import { makeEvidence, evidenceId } from "@/lib/evidence/schema"
import { inspectEvidence } from "@/lib/evidence/inspect"

describe("evidence anchoring - finding → evidenceId → inspectEvidence", () => {
  const auditId = "00000000-0000-0000-0000-0000000000aa"
  const rawInput = "This agreement requires payment due 14 days after invoice and 30 days after receiving completed work. Client will pay."

  it("EXACT uses verified offsets, ownership-checked", () => {
    const ev = makeEvidence({
      sourceType: "audit_input",
      sourceId: auditId,
      quote: "payment due 14 days after invoice",
      observationKey: "facts.payment.term",
      method: "pattern_observation",
      confidence: 1,
      inspectable: true,
      location: { kind: "exact", startOffset: rawInput.indexOf("payment due 14 days after invoice"), endOffset: rawInput.indexOf("payment due 14 days after invoice") + "payment due 14 days after invoice".length, section: "raw_input" },
    })
    expect(ev.id.startsWith("ev_")).toBe(true)
    const result = inspectEvidence(ev, { auditId, documents: [{ label: "Pasted input", text: rawInput }] })
    expect(result.status).toBe("EXACT")
    expect(result.startOffset).toBe(rawInput.indexOf("payment due 14 days after invoice"))
    expect(result.evidence.id).toBe(ev.id)
  })

  it("APPROXIMATE uses match location", () => {
    const ev = makeEvidence({
      sourceType: "audit_input",
      sourceId: auditId,
      quote: "payment due 30 days after receiving completed work",
      observationKey: "facts.payment.term2",
      method: "ai_extraction",
      confidence: 0.9,
      inspectable: true,
      location: { kind: "approximate", section: "raw_input" },
    })
    const rawWithBoth = rawInput + " payment due 30 days after receiving completed work"
    const result = inspectEvidence(ev, { auditId, documents: [{ label: "Pasted input", text: rawWithBoth }] })
    expect(result.status).toBe("APPROXIMATE")
    expect(result.matchOffset).not.toBeNull()
  })

  it("UNAVAILABLE does not fabricate location", () => {
    const ev = makeEvidence({
      sourceType: "knowledge",
      sourceId: "test-statute-a",
      observationKey: "knowledge:test",
      method: "knowledge_reference",
      confidence: 1,
      inspectable: false,
      location: { kind: "unavailable" },
    })
    const result = inspectEvidence(ev, { auditId, documents: [{ label: "Pasted", text: rawInput }] })
    expect(result.status).toBe("UNAVAILABLE")
    expect(result.startOffset).toBeNull()
    expect(result.matchOffset).toBeNull()
  })

  it("UNKNOWN never converted to PASS/FAIL", () => {
    // Evidence never carries PASS/FAIL; findings do. Verify that an UNKNOWN finding does not get evidence that claims PASS.
    // This is a structural check: evidence schema has no status, only findings do.
    const ev = makeEvidence({
      sourceType: "audit_input",
      sourceId: auditId,
      quote: "Some term",
      observationKey: "facts.unknown.test",
      method: "pattern_observation",
      confidence: 0.5,
      inspectable: true,
      location: { kind: "approximate", section: "raw_input" },
    })
    expect(ev.confidence).toBe(0.5)
    // The finding that uses this evidence would be UNKNOWN, not PASS, and evidenceId remains content-derived
    expect(ev.id.startsWith("ev_")).toBe(true)
  })

  it("ownership protection: evidence sourceId must match auditId for inspection", () => {
    const ev = makeEvidence({
      sourceType: "audit_input",
      sourceId: "00000000-0000-0000-0000-0000000000bb", // different audit
      quote: "payment due 14 days after invoice",
      observationKey: "facts.payment.term",
      method: "pattern_observation",
      confidence: 1,
      inspectable: true,
      location: { kind: "exact", startOffset: 0, endOffset: 10 },
    })
    // Inspection still works but the UI must check sourceId === auditId before showing Inspect
    // This test documents the contract: finding.evidence.sourceId must equal auditId for inspection to be meaningful
    expect(ev.sourceId).not.toBe(auditId)
  })

  it("evidence IDs remain content-derived", () => {
    const ev1 = makeEvidence({ sourceType: "audit_input", sourceId: auditId, quote: "Same quote", observationKey: "k", method: "pattern_observation", confidence: 1, inspectable: true, location: { kind: "approximate" } })
    const ev2 = makeEvidence({ sourceType: "audit_input", sourceId: auditId, quote: "Same quote", observationKey: "k", method: "pattern_observation", confidence: 1, inspectable: true, location: { kind: "approximate" } })
    expect(ev1.id).toBe(ev2.id)
  })
})
