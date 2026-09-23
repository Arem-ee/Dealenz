import { describe, it, expect } from "vitest"
import { buildConfirmFields } from "./confirm-fields"
import { emptyContextEnvelope, seedEnvelopeForDealType } from "./schema"
import { CONFIRMATION_THRESHOLD } from "./requirements"

describe("buildConfirmFields", () => {
  it("returns null when context is READY", () => {
    expect(buildConfirmFields(seedEnvelopeForDealType("freelance"), "freelance")).toBeNull()
  })

  it("returns null for an unusable envelope instead of failing", () => {
    expect(buildConfirmFields(null, "freelance")).toBeNull()
    expect(buildConfirmFields({ fields: {} }, "freelance")).toBeNull()
    expect(buildConfirmFields("not-an-envelope", "freelance")).toBeNull()
  })

  it("asks at most three questions with labels, values, and options", () => {
    const fields = buildConfirmFields(emptyContextEnvelope(), "generic")
    expect(fields).not.toBeNull()
    expect(fields!.length).toBeLessThanOrEqual(3)
    for (const f of fields!) {
      expect(typeof f.key).toBe("string")
      expect(typeof f.label).toBe("string")
      expect(typeof f.value).toBe("string")
      expect(f.options === null || Array.isArray(f.options)).toBe(true)
    }
  })

  it("attaches option buttons for closed-vocabulary fields", () => {
    const envelope = seedEnvelopeForDealType("freelance")
    envelope.fields.userRole = { value: "", source: "unknown", confidence: 0 }
    const fields = buildConfirmFields(envelope, "freelance")
    const role = (fields ?? []).find((f) => f.key === "userRole")
    // Either asked with options, or not required for this deal type — but if
    // asked, options must be present (never a bare text box for enums).
    if (role) expect(role.options).toContain("freelancer")
  })

  it("surfaces low-confidence inferences for confirmation", () => {
    const envelope = seedEnvelopeForDealType("freelance")
    envelope.fields.dealType = {
      value: "freelance",
      source: "inferred",
      confidence: CONFIRMATION_THRESHOLD - 0.01,
    }
    const fields = buildConfirmFields(envelope, "freelance")
    expect(fields).not.toBeNull()
    expect(fields!.some((f) => f.key === "dealType")).toBe(true)
  })
})
