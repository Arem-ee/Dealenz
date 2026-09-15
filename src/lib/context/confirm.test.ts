import { describe, it, expect } from "vitest"
import { applyUserConfirmation } from "./confirm"
import { emptyContextEnvelope, seedEnvelopeForDealType } from "./schema"

describe("user confirmation", () => {
  it("applies a correction as user_confirmed and bumps the version", () => {
    const base = seedEnvelopeForDealType("freelance")
    const next = applyUserConfirmation(base, {
      jurisdiction: { value: "United Kingdom" },
    })
    expect(next.version).toBe(2)
    expect(next.fields.jurisdiction).toEqual({ value: "United Kingdom", source: "user_confirmed", confidence: 1 })
  })

  it("leaves unrelated fields unchanged", () => {
    const base = seedEnvelopeForDealType("freelance")
    base.fields.industry = { value: "technology", source: "inferred", confidence: 0.7 }
    const next = applyUserConfirmation(base, { jurisdiction: { value: "Canada", confidence: 0.9 } })
    expect(next.fields.industry).toEqual({ value: "technology", source: "inferred", confidence: 0.7 })
    expect(next.fields.jurisdiction).toEqual({ value: "Canada", source: "user_confirmed", confidence: 0.9 })
    expect(next.fields.dealType.source).toBe("user_confirmed")
  })

  it("confirms intent and priorities with the same semantics", () => {
    const base = seedEnvelopeForDealType("freelance")
    const next = applyUserConfirmation(base, {
      intent: { value: "review" },
      priorities: { value: ["fee_terms", "ip_ownership"] },
    })
    expect(next.version).toBe(2)
    expect(next.fields.intent).toEqual({ value: "review", source: "user_confirmed", confidence: 1 })
    expect(next.fields.priorities).toEqual({ value: ["fee_terms", "ip_ownership"], source: "user_confirmed", confidence: 1 })
  })

  it("rejects invalid intent and priority values server-side", () => {
    expect(() =>
      applyUserConfirmation(seedEnvelopeForDealType("freelance"), {
        intent: { value: "litigate" },
      })
    ).toThrow(/invalid value/)
    expect(() =>
      applyUserConfirmation(seedEnvelopeForDealType("freelance"), {
        priorities: { value: [] },
      })
    ).toThrow()
  })

  it("rejects empty updates", () => {
    expect(() => applyUserConfirmation(seedEnvelopeForDealType("freelance"), {})).toThrow(/No context updates/)
  })

  it("rejects unknown fields", () => {
    expect(() =>
      applyUserConfirmation(seedEnvelopeForDealType("freelance"), {
        statuteOfLimitations: { value: "x" },
      } as never)
    ).toThrow(/Unknown context field/)
  })

  it("rejects invalid values server-side (bad enum, bad confidence)", () => {
    expect(() =>
      applyUserConfirmation(seedEnvelopeForDealType("freelance"), {
        userRole: { value: "not_a_role" },
      })
    ).toThrow(/invalid value/)
    expect(() =>
      applyUserConfirmation(seedEnvelopeForDealType("freelance"), {
        jurisdiction: { value: "Canada", confidence: 7 },
      })
    ).toThrow(/invalid confidence/)
    expect(() =>
      applyUserConfirmation(seedEnvelopeForDealType("freelance"), {
        transactionCurrency: { value: "bucks" },
      })
    ).toThrow(/invalid value/)
  })

  it("accepts a full multi-field confirmation in one call", () => {
    const next = applyUserConfirmation(emptyContextEnvelope(), {
      dealType: { value: "generic" },
      jurisdiction: { value: "Germany" },
      crossBorder: { value: true },
    })
    expect(next.version).toBe(1)
    expect(next.fields.dealType.source).toBe("user_confirmed")
    expect(next.fields.crossBorder).toEqual({ value: true, source: "user_confirmed", confidence: 1 })
    expect(next.fields.industry.source).toBe("unknown")
  })
})
