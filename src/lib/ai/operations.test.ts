import { describe, it, expect } from "vitest"
import {
  AI_OPERATIONS,
  USER_OBJECTIVES,
  maxTokensForBudget,
  maxTokensForOperation,
  resolveOperationProfile,
  totalTokens,
  type AIOperation,
} from "./operations"

describe("AI operations", () => {
  it("supports conversation as a first-class operation alongside document analysis", () => {
    expect(AI_OPERATIONS).toContain("conversation")
    expect(AI_OPERATIONS).toContain("document_analysis")
    expect(AI_OPERATIONS).toContain("negotiation")
    expect(AI_OPERATIONS).toContain("drafting")
    expect(AI_OPERATIONS).toContain("comparison")
    expect(AI_OPERATIONS).toContain("explanation")
    expect(AI_OPERATIONS).toContain("decision_support")
  })

  it("does not require a document for conversation", () => {
    expect(resolveOperationProfile("conversation").requiresDocument).toBe(false)
    expect(resolveOperationProfile("explanation").requiresDocument).toBe(false)
    expect(resolveOperationProfile("decision_support").requiresDocument).toBe(false)
    expect(resolveOperationProfile("document_analysis").requiresDocument).toBe(true)
  })

  it("keeps input distinct from intent", () => {
    // Same document input, different intents: the vocabulary allows review of
    // an upload without equating upload with review.
    expect(resolveOperationProfile("document_analysis").defaultIntent).toBe("review")
    expect(resolveOperationProfile("conversation").defaultIntent).toBe("explore")
    expect(resolveOperationProfile("decision_support").defaultIntent).toBe("decide")
  })

  it("represents user objectives separately from deal facts", () => {
    expect(USER_OBJECTIVES).toContain("decide_whether_to_accept")
    expect(USER_OBJECTIVES).toContain("compare_alternatives")
    expect(USER_OBJECTIVES).toContain("protect_ownership")
    expect(new Set(USER_OBJECTIVES).size).toBe(USER_OBJECTIVES.length)
  })

  it("lets simple operations use low output budgets", () => {
    expect(maxTokensForOperation("conversation")).toBeLessThan(maxTokensForOperation("document_analysis"))
    expect(maxTokensForOperation("explanation")).toBeLessThan(maxTokensForOperation("decision_support"))
    const ordered: AIOperation[] = ["conversation", "decision_support", "document_analysis"]
    const budgets = ordered.map((op) => maxTokensForOperation(op))
    expect([...budgets].sort((a, b) => a - b)).toEqual(budgets)
  })

  it("keeps budget tiers ordered and positive", () => {
    expect(maxTokensForBudget("brief")).toBeGreaterThan(0)
    expect(maxTokensForBudget("brief")).toBeLessThan(maxTokensForBudget("standard"))
    expect(maxTokensForBudget("standard")).toBeLessThan(maxTokensForBudget("extended"))
  })

  it("selects minimal context for simple questions", () => {
    expect(resolveOperationProfile("conversation").contextSelection).toBe("minimal")
    expect(resolveOperationProfile("explanation").contextSelection).toBe("minimal")
    expect(resolveOperationProfile("document_analysis").contextSelection).toBe("expanded")
  })

  it("declares document, context, and rules requirements per operation", () => {
    // Only document analysis is gate-enforced and document-mandatory.
    expect(resolveOperationProfile("document_analysis").requiresContext).toBe(true)
    expect(resolveOperationProfile("conversation").requiresContext).toBe(false)
    expect(resolveOperationProfile("negotiation").requiresContext).toBe(false)
    // Rules consumers exist everywhere except drafting (no consumer yet).
    expect(resolveOperationProfile("document_analysis").usesRules).toBe(true)
    expect(resolveOperationProfile("conversation").usesRules).toBe(true)
    expect(resolveOperationProfile("negotiation").usesRules).toBe(true)
    expect(resolveOperationProfile("comparison").usesRules).toBe(true)
    expect(resolveOperationProfile("explanation").usesRules).toBe(true)
    expect(resolveOperationProfile("decision_support").usesRules).toBe(true)
    expect(resolveOperationProfile("drafting").usesRules).toBe(false)
  })
})

describe("token accounting primitives", () => {
  it("derives totals from measured input and output", () => {
    expect(totalTokens({ inputTokens: 120, outputTokens: 8 })).toBe(128)
  })
})
