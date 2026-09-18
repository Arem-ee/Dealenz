import { describe, it, expect } from "vitest"
import { canonicalJson, payloadHash, planPayloadHash } from "./hash"

describe("canonicalJson", () => {
  it("sorts keys deterministically", () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}')
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }))
  })
  it("handles arrays and nesting", () => {
    expect(canonicalJson([{ b: 2, a: 1 }])).toBe('[{"a":1,"b":2}]')
  })
})

describe("payloadHash", () => {
  it("is deterministic", () => {
    expect(payloadHash({ a: 1, b: 2 })).toBe(payloadHash({ b: 2, a: 1 }))
    expect(payloadHash({ a: 1 })).not.toBe(payloadHash({ a: 2 }))
  })
})

describe("planPayloadHash", () => {
  it("binds objective+steps+credits", () => {
    const base = { objective: "Prepare proposals", objectiveKind: "proposal_batch", estimatedCredits: 5, steps: [{ operation: "validate_rows", inputRef: {}, dependsOn: [], estimatedCredits: 2 }] }
    expect(planPayloadHash(base)).toBe(planPayloadHash({ ...base }))
    expect(planPayloadHash({ ...base, estimatedCredits: 6 })).not.toBe(planPayloadHash(base))
    expect(planPayloadHash({ ...base, steps: [{ operation: "validate_rows", inputRef: { rows: 1 }, dependsOn: [], estimatedCredits: 2 }] })).not.toBe(planPayloadHash(base))
  })
  it("sorts dependsOn", () => {
    const a = { objective: "x", objectiveKind: "custom", estimatedCredits: 2, steps: [{ operation: "generate_draft", inputRef: {}, dependsOn: ["z", "a"], estimatedCredits: 1 }] }
    const b = { objective: "x", objectiveKind: "custom", estimatedCredits: 2, steps: [{ operation: "generate_draft", inputRef: {}, dependsOn: ["a", "z"], estimatedCredits: 1 }] }
    expect(planPayloadHash(a as never)).toBe(planPayloadHash(b as never))
  })
})
