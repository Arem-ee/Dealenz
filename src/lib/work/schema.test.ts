import { describe, it, expect } from "vitest"
import { validateCreatePlan, sumEstimatedCredits } from "./schema"

describe("validateCreatePlan", () => {
  const validUser = "00000000-0000-0000-0000-000000000001"
  it("accepts valid plan", () => {
    expect(validateCreatePlan({ userId: validUser, objective: "Analyze this deal", steps: [{ operation: "document_analysis", estimatedCredits: 3 }] })).toBeNull()
  })
  it("rejects empty objective", () => {
    expect(validateCreatePlan({ userId: validUser, objective: " ", steps: [{ operation: "document_analysis", estimatedCredits: 3 }] })).not.toBeNull()
  })
  it("rejects empty steps", () => {
    expect(validateCreatePlan({ userId: validUser, objective: "x", steps: [] })).not.toBeNull()
  })
  it("rejects >50 steps", () => {
    expect(validateCreatePlan({ userId: validUser, objective: "x", steps: Array.from({ length: 51 }, () => ({ operation: "document_analysis", estimatedCredits: 1 })) })).not.toBeNull()
  })
  it("rejects invalid userId", () => {
    expect(validateCreatePlan({ userId: "not-uuid", objective: "x", steps: [{ operation: "x", estimatedCredits: 1 }] })).not.toBeNull()
  })
})

describe("sumEstimatedCredits", () => {
  it("sums correctly", () => {
    expect(sumEstimatedCredits([{ estimatedCredits: 2 }, { estimatedCredits: 3 }])).toBe(5)
    expect(sumEstimatedCredits([])).toBe(0)
  })
})
