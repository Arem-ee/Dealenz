import { describe, it, expect } from "vitest"
import { emptyContextEnvelope, seedEnvelopeForDealType, type ContextEnvelope } from "./schema"
import { CONFIRMATION_THRESHOLD, registerContextRequirements, requiredContextFields } from "./requirements"
import { evaluateContextGate } from "./gate"

function confirmedDealType(): ContextEnvelope {
  return seedEnvelopeForDealType("freelance")
}

describe("context gate", () => {
  it("returns READY for complete context", () => {
    const result = evaluateContextGate(confirmedDealType(), "freelance")
    expect(result.state).toBe("READY")
    expect(result.missingRequired).toEqual([])
    expect(result.unconfirmedRequired).toEqual([])
  })

  it("returns MISSING_REQUIRED_CONTEXT when no envelope exists", () => {
    const result = evaluateContextGate(null, "freelance")
    expect(result.state).toBe("MISSING_REQUIRED_CONTEXT")
    expect(result.missingRequired).toEqual(["dealType"])
  })

  it("returns MISSING_REQUIRED_CONTEXT for an unknown required field", () => {
    const envelope = emptyContextEnvelope()
    const result = evaluateContextGate(envelope, "generic")
    expect(result.state).toBe("MISSING_REQUIRED_CONTEXT")
    expect(result.missingRequired).toContain("dealType")
  })

  it("returns NEEDS_CONFIRMATION for a low-confidence inferred required field", () => {
    const envelope = seedEnvelopeForDealType("freelance")
    envelope.fields.dealType = {
      value: "freelance",
      source: "inferred",
      confidence: CONFIRMATION_THRESHOLD - 0.01,
    }
    const result = evaluateContextGate(envelope, "freelance")
    expect(result.state).toBe("NEEDS_CONFIRMATION")
    expect(result.unconfirmedRequired).toEqual(["dealType"])
    expect(result.missingRequired).toEqual([])
  })

  it("accepts high-confidence inferred required fields", () => {
    const envelope = seedEnvelopeForDealType("freelance")
    envelope.fields.dealType = {
      value: "freelance",
      source: "inferred",
      confidence: CONFIRMATION_THRESHOLD,
    }
    const result = evaluateContextGate(envelope, "freelance")
    expect(result.state).toBe("READY")
  })

  it("never blocks on unknown optional fields", () => {
    const envelope = confirmedDealType()
    // Every non-required field stays unknown.
    const result = evaluateContextGate(envelope, "freelance")
    expect(result.state).toBe("READY")
    expect(envelope.fields.jurisdiction.source).toBe("unknown")
    expect(envelope.fields.counterpartyRole.source).toBe("unknown")
  })

  it("never blocks on unknown intent or priorities", () => {
    expect(requiredContextFields("freelance")).toEqual(["dealType"])
    const envelope = confirmedDealType()
    expect(envelope.fields.intent.source).toBe("unknown")
    expect(envelope.fields.priorities.source).toBe("unknown")
    const result = evaluateContextGate(envelope, "freelance")
    expect(result.state).toBe("READY")
  })

  it("lets future modules declare additional requirements", () => {
    registerContextRequirements("generic", ["jurisdiction"])
    try {
      expect(requiredContextFields("generic")).toContain("jurisdiction")
      const withoutJurisdiction = seedEnvelopeForDealType("generic")
      expect(evaluateContextGate(withoutJurisdiction, "generic").state).toBe("MISSING_REQUIRED_CONTEXT")
      const withJurisdiction = seedEnvelopeForDealType("generic")
      withJurisdiction.fields.jurisdiction = { value: "Canada", source: "user_confirmed", confidence: 1 }
      expect(evaluateContextGate(withJurisdiction, "generic").state).toBe("READY")
    } finally {
      registerContextRequirements("generic", [])
    }
    expect(requiredContextFields("generic")).toEqual(["dealType"])
  })
})
