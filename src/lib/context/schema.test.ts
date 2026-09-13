import { describe, it, expect } from "vitest"
import {
  emptyContextEnvelope,
  parseContextEnvelope,
  seedEnvelopeForDealType,
} from "./schema"

function validEnvelopeRaw() {
  return {
    version: 2,
    fields: {
      dealType: { value: "freelance", source: "user_confirmed", confidence: 1 },
      intent: { value: "review", source: "user_confirmed", confidence: 1 },
      priorities: { value: ["fee_terms", "payment_timing"], source: "inferred", confidence: 0.8 },
      jurisdiction: { value: "United Kingdom", source: "inferred", confidence: 0.81 },
      governingLaw: { value: null, source: "unknown", confidence: 0 },
      userRole: { value: "freelancer", source: "user_confirmed", confidence: 1 },
      counterpartyRole: { value: null, source: "unknown", confidence: 0 },
      industry: { value: "technology", source: "inferred", confidence: 0.9 },
      transactionStructure: { value: null, source: "unknown", confidence: 0 },
      transactionValue: { value: 5000, source: "inferred", confidence: 0.8 },
      transactionCurrency: { value: "USD", source: "inferred", confidence: 0.8 },
      transactionStage: { value: "negotiation", source: "inferred", confidence: 0.77 },
      crossBorder: { value: false, source: "inferred", confidence: 0.9 },
      regulatedIndustry: { value: null, source: "unknown", confidence: 0 },
      entityTypes: { value: ["individual", "company"], source: "inferred", confidence: 0.82 },
    },
    missingRequiredContext: [],
    updatedAt: "2026-09-04T00:00:00.000Z",
    updatedBy: "user-1",
  }
}

describe("context schema", () => {
  it("accepts a valid envelope", () => {
    const envelope = parseContextEnvelope(validEnvelopeRaw())
    expect(envelope.version).toBe(2)
    expect(envelope.fields.jurisdiction).toEqual({ value: "United Kingdom", source: "inferred", confidence: 0.81 })
    expect(envelope.fields.entityTypes.value).toEqual(["individual", "company"])
  })

  it("rejects an invalid source value", () => {
    const raw = validEnvelopeRaw() as Record<string, unknown>
    const fields = raw.fields as Record<string, unknown>
    fields.jurisdiction = { value: "United Kingdom", source: "ai_guess", confidence: 0.8 }
    expect(() => parseContextEnvelope(raw)).toThrow(/invalid source/)
  })

  it("rejects out-of-bounds confidence", () => {
    for (const confidence of [-0.1, 1.5, Number.NaN, "high"]) {
      const raw = validEnvelopeRaw() as Record<string, unknown>
      const fields = raw.fields as Record<string, unknown>
      fields.industry = { value: "technology", source: "inferred", confidence }
      expect(() => parseContextEnvelope(raw)).toThrow(/invalid confidence/)
    }
  })

  it("accepts confidence boundary values 0 and 1 in the right states", () => {
    const raw = validEnvelopeRaw()
    // unknown fields carry confidence 0; confirmed fields may carry 1.
    expect(() => parseContextEnvelope(raw)).not.toThrow()
    expect(raw.fields.governingLaw.confidence).toBe(0)
    expect(raw.fields.dealType.confidence).toBe(1)
  })

  it("rejects unknown-source fields carrying a value or confidence", () => {
    const raw = validEnvelopeRaw() as Record<string, unknown>
    const fields = raw.fields as Record<string, unknown>
    fields.governingLaw = { value: "Something", source: "unknown", confidence: 0 }
    expect(() => parseContextEnvelope(raw)).toThrow()
    fields.governingLaw = { value: null, source: "unknown", confidence: 0.5 }
    expect(() => parseContextEnvelope(raw)).toThrow()
  })

  it("rejects inferred fields without a value or confidence", () => {
    const raw = validEnvelopeRaw() as Record<string, unknown>
    const fields = raw.fields as Record<string, unknown>
    fields.jurisdiction = { value: null, source: "inferred", confidence: 0.8 }
    expect(() => parseContextEnvelope(raw)).toThrow()
  })

  it("rejects out-of-vocabulary enum values", () => {
    const raw = validEnvelopeRaw() as Record<string, unknown>
    const fields = raw.fields as Record<string, unknown>
    fields.userRole = { value: "sovereign_citizen", source: "inferred", confidence: 0.8 }
    expect(() => parseContextEnvelope(raw)).toThrow(/invalid value/)
  })

  it("rejects malformed envelopes", () => {
    expect(() => parseContextEnvelope(null)).toThrow()
    expect(() => parseContextEnvelope([])).toThrow()
    expect(() => parseContextEnvelope({ version: -1, fields: {} })).toThrow()
    expect(() => parseContextEnvelope({ ...validEnvelopeRaw(), version: 1.5 })).toThrow()
    const missing = validEnvelopeRaw() as Record<string, unknown>
    const fields = { ...(missing.fields as Record<string, unknown>) }
    delete fields.industry
    missing.fields = fields
    expect(() => parseContextEnvelope(missing)).toThrow(/field set/)
  })

  it("rejects bad currency, amount, and entity lists", () => {
    const raw = validEnvelopeRaw() as Record<string, unknown>
    const fields = raw.fields as Record<string, unknown>
    fields.transactionCurrency = { value: "US dollars", source: "inferred", confidence: 0.8 }
    expect(() => parseContextEnvelope(raw)).toThrow()
    fields.transactionCurrency = { value: null, source: "unknown", confidence: 0 }
    fields.transactionValue = { value: -5, source: "inferred", confidence: 0.8 }
    expect(() => parseContextEnvelope(raw)).toThrow()
    fields.transactionValue = { value: null, source: "unknown", confidence: 0 }
    fields.entityTypes = { value: ["individual", "dragon"], source: "inferred", confidence: 0.8 }
    expect(() => parseContextEnvelope(raw)).toThrow()
  })

  it("rejects bad intent values and priority lists", () => {
    const raw = validEnvelopeRaw() as Record<string, unknown>
    const fields = raw.fields as Record<string, unknown>
    fields.intent = { value: "litigate", source: "inferred", confidence: 0.8 }
    expect(() => parseContextEnvelope(raw)).toThrow(/invalid value/)
    fields.intent = { value: "review", source: "user_confirmed", confidence: 1 }
    fields.priorities = { value: [], source: "inferred", confidence: 0.8 }
    expect(() => parseContextEnvelope(raw)).toThrow()
    fields.priorities = { value: ["fee_terms", "fee_terms"], source: "inferred", confidence: 0.8 }
    expect(() => parseContextEnvelope(raw)).toThrow()
    fields.priorities = { value: ["Fee Terms"], source: "inferred", confidence: 0.8 }
    expect(() => parseContextEnvelope(raw)).toThrow()
    fields.priorities = { value: ["a", "b", "c", "d", "e", "f", "g"], source: "inferred", confidence: 0.8 }
    expect(() => parseContextEnvelope(raw)).toThrow()
    fields.priorities = { value: ["fee_terms", "payment_timing"], source: "inferred", confidence: 0.8 }
    expect(() => parseContextEnvelope(raw)).not.toThrow()
  })

  it("seeds intent and priorities as unknown at creation", () => {
    const envelope = seedEnvelopeForDealType("founder")
    expect(envelope.fields.intent).toEqual({ value: null, source: "unknown", confidence: 0 })
    expect(envelope.fields.priorities).toEqual({ value: null, source: "unknown", confidence: 0 })
    expect(() => parseContextEnvelope(envelope)).not.toThrow()
  })
  it("builds an empty envelope with everything unknown", () => {
    const envelope = emptyContextEnvelope()
    expect(envelope.version).toBe(0)
    for (const field of Object.values(envelope.fields)) {
      expect(field).toEqual({ value: null, source: "unknown", confidence: 0 })
    }
    expect(() => parseContextEnvelope(envelope)).not.toThrow()
  })

  it("seeds deal type as user_confirmed at creation", () => {
    const envelope = seedEnvelopeForDealType("generic")
    expect(envelope.version).toBe(1)
    expect(envelope.fields.dealType).toEqual({ value: "generic", source: "user_confirmed", confidence: 1 })
    expect(envelope.fields.jurisdiction.source).toBe("unknown")
    expect(() => parseContextEnvelope(envelope)).not.toThrow()
  })
})
