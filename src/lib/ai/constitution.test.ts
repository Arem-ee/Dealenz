import { describe, it, expect } from "vitest"
import {
  CONSTITUTION_PRINCIPLES,
  CONSTITUTION_TEXT,
  applyConstitution,
  operationNeedsConstitution,
  validateOutputContract,
} from "./constitution"
import * as prompts from "./prompts"

describe("AI constitution", () => {
  it("exists as a durable module with user-first principles", () => {
    expect(CONSTITUTION_PRINCIPLES.length).toBeGreaterThanOrEqual(7)
    expect(CONSTITUTION_TEXT).toMatch(/works for the user/i)
    expect(CONSTITUTION_TEXT).toMatch(/never.*closing the deal|not.*closing the deal/i)
  })

  it("represents uncertainty rules", () => {
    expect(CONSTITUTION_TEXT).toMatch(/nknown must never become false/i)
    expect(CONSTITUTION_TEXT).toMatch(/missing or unconfirmed information/i)
  })

  it("prohibits em dashes in its own text", () => {
    expect(validateOutputContract(CONSTITUTION_TEXT).passed).toBe(true)
  })

  it("requires the em dash prohibition explicitly", () => {
    expect(CONSTITUTION_TEXT).toMatch(/em dash/)
  })

  it("encodes concise-by-default behavior", () => {
    expect(CONSTITUTION_TEXT).toMatch(/as concise as the task allows/i)
    expect(CONSTITUTION_TEXT).toMatch(/short answer is correct/i)
    expect(CONSTITUTION_TEXT).toMatch(/unnecessary computation or words/i)
  })

  it("asks at most one question at a time", () => {
    expect(CONSTITUTION_TEXT).toMatch(/at most one question at a time/i)
    expect(CONSTITUTION_TEXT).toMatch(/most important question first/i)
  })

  it("caps a response at one question and one missing item", () => {
    expect(CONSTITUTION_TEXT).toMatch(/at most one question per response/i)
    expect(CONSTITUTION_TEXT).toMatch(/single most important missing item/i)
    expect(CONSTITUTION_TEXT).toMatch(/never enumerate everything missing/i)
    expect(CONSTITUTION_TEXT).toMatch(/at most three short sentences before the single question/i)
  })

  it("encodes user-first non-sycophancy", () => {
    expect(CONSTITUTION_TEXT).toMatch(/disadvantage/i)
    expect(CONSTITUTION_TEXT).toMatch(/insufficient is always acceptable|insufficient/i)
  })

  it("separates user interest from platform revenue", () => {
    expect(CONSTITUTION_TEXT).toMatch(/never buy a favorable answer/i)
    expect(CONSTITUTION_TEXT).toMatch(/Credits pay for computation/i)
  })
})

describe("applyConstitution", () => {
  it("leaves structured extraction-style operations untouched", () => {
    const prompt = "Return ONLY valid JSON."
    expect(applyConstitution(prompt, "document_analysis")).toBe(prompt)
    expect(operationNeedsConstitution("document_analysis")).toBe(false)
  })

  it("attaches the contract to user-facing operations", () => {
    for (const op of ["conversation", "negotiation", "explanation", "decision_support", "comparison", "drafting"] as const) {
      expect(operationNeedsConstitution(op)).toBe(true)
      const out = applyConstitution("Help the user.", op)
      expect(out).toContain("Help the user.")
      expect(out).toContain("Dealenz response contract")
      expect(validateOutputContract(out).passed).toBe(true)
    }
  })
})

describe("validateOutputContract", () => {
  it("rejects em dashes and empty output", () => {
    expect(validateOutputContract("Plain text, no issues.").passed).toBe(true)
    const withDash = validateOutputContract("This — that.")
    expect(withDash.hasEmDash).toBe(true)
    expect(withDash.passed).toBe(false)
    expect(validateOutputContract("   ").passed).toBe(false)
  })

  it("counts questions without changing the pass contract", () => {
    expect(validateOutputContract("Plain text, no issues.").questionCount).toBe(0)
    expect(validateOutputContract("Is this right?").questionCount).toBe(1)
    expect(validateOutputContract("Is this right?").asksTooManyQuestions).toBe(false)
    // The screenshot offense: known/missing enumeration plus a question list.
    const barrage = validateOutputContract(
      "What is known: X. What is missing: Y. Who is the counterparty? What do they owe? When does it vest?"
    )
    expect(barrage.questionCount).toBe(3)
    expect(barrage.asksTooManyQuestions).toBe(true)
    // Detection only: the pass contract stays em dash plus empty so every
    // existing prompt template keeps passing.
    expect(barrage.passed).toBe(true)
  })

  it("holds across every exported prompt template", () => {
    const checked: string[] = []
    for (const value of Object.values(prompts)) {
      if (typeof value === "string" && value.length > 0) {
        checked.push(value)
        expect(validateOutputContract(value).passed).toBe(true)
      }
    }
    // Guard against the test silently checking nothing.
    expect(checked.length).toBeGreaterThan(0)
  })
})
