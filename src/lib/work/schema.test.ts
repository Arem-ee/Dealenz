import { describe, it, expect } from "vitest"
import { MAX_BATCH_DEALS, validateBatchItems, validateCreatePlan, sumEstimatedCredits } from "./schema"

describe("validateCreatePlan", () => {
  const validUser = "00000000-0000-0000-0000-000000000001"
  it("accepts valid plan", () => {
    expect(validateCreatePlan({ userId: validUser, objective: "Analyze this deal", steps: [{ operation: "document_analysis", estimatedCredits: 5 }] })).toBeNull()
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

describe("estimate floors", () => {
  const user = "00000000-0000-0000-0000-000000000001"
  it("rejects below-minimum estimates for AI operations", () => {
    expect(
      validateCreatePlan({ userId: user, objective: "x", steps: [{ operation: "document_analysis", estimatedCredits: 0 }] })
    ).toMatch(/minimum 5 credits/)
    expect(
      validateCreatePlan({ userId: user, objective: "x", steps: [{ operation: "document_analysis", estimatedCredits: 4 }] })
    ).not.toBeNull()
    expect(
      validateCreatePlan({ userId: user, objective: "x", steps: [{ operation: "generate_draft", estimatedCredits: 0 }] })
    ).not.toBeNull()
  })

  it("accepts floored AI estimates and zero-cost deterministic steps", () => {
    expect(
      validateCreatePlan({ userId: user, objective: "x", steps: [{ operation: "document_analysis", estimatedCredits: 5 }] })
    ).toBeNull()
    expect(
      validateCreatePlan({ userId: user, objective: "x", steps: [{ operation: "generate_draft", estimatedCredits: 1 }] })
    ).toBeNull()
    expect(
      validateCreatePlan({ userId: user, objective: "x", steps: [{ operation: "validate_rows", estimatedCredits: 0 }] })
    ).toBeNull()
  })
})

describe("validateBatchItems", () => {
  const item = (n: number) => ({
    auditId: `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`,
    threadId: `11111111-1111-1111-1111-1111111111${String(n).padStart(2, "0")}`,
  })
  it("accepts 1 to MAX_BATCH_DEALS distinct deals", () => {
    expect(validateBatchItems([item(1)])).toBeNull()
    expect(validateBatchItems([item(1), item(2), item(3)])).toBeNull()
    expect(validateBatchItems(Array.from({ length: MAX_BATCH_DEALS }, (_, i) => item(i + 1)))).toBeNull()
  })
  it("rejects empty, oversized, invalid, and duplicated batches", () => {
    expect(validateBatchItems([])).not.toBeNull()
    expect(validateBatchItems(Array.from({ length: MAX_BATCH_DEALS + 1 }, (_, i) => item(i + 1)))).not.toBeNull()
    expect(validateBatchItems([{ auditId: "nope", threadId: item(1).threadId }])).not.toBeNull()
    expect(validateBatchItems([{ auditId: item(1).auditId, threadId: "nope" }])).not.toBeNull()
    expect(validateBatchItems([item(1), { auditId: item(1).auditId, threadId: item(2).threadId }])).not.toBeNull()
  })
})
