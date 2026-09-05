import { describe, it, expect } from "vitest"
import {
  CREDIT_PRICE_BRIEF,
  CREDIT_PRICE_STANDARD,
  CREDIT_PRICE_EXTENDED,
  STANDARD_CREDIT_POLICY,
  priceForOperation,
} from "./pricing"

describe("standard credit policy", () => {
  it("prices operations by budget tier, not by tokens", () => {
    expect(priceForOperation("conversation")).toBe(CREDIT_PRICE_BRIEF)
    expect(priceForOperation("explanation")).toBe(CREDIT_PRICE_BRIEF)
    expect(priceForOperation("decision_support")).toBe(CREDIT_PRICE_STANDARD)
    expect(priceForOperation("document_analysis")).toBe(CREDIT_PRICE_EXTENDED)
    expect(CREDIT_PRICE_BRIEF).toBeLessThan(CREDIT_PRICE_STANDARD)
    expect(CREDIT_PRICE_STANDARD).toBeLessThan(CREDIT_PRICE_EXTENDED)
  })

  it("estimates and charges the same tier price regardless of measured tokens", () => {
    expect(STANDARD_CREDIT_POLICY.estimateMaxCredits("conversation")).toBe(1)
    const small = STANDARD_CREDIT_POLICY.creditsForUsage({
      operation: "conversation", provider: "anthropic", model: "m",
      inputTokens: 50, outputTokens: 10, totalTokens: 60,
      creditsConsumed: null, status: "success", createdAt: new Date().toISOString(),
    })
    const large = STANDARD_CREDIT_POLICY.creditsForUsage({
      operation: "conversation", provider: "anthropic", model: "m",
      inputTokens: 5000, outputTokens: 900, totalTokens: 5900,
      creditsConsumed: null, status: "success", createdAt: new Date().toISOString(),
    })
    // Flat operation price: tokens are recorded for future pricing review,
    // never converted at a token rate.
    expect(small).toBe(large)
    expect(small).toBe(CREDIT_PRICE_BRIEF)
  })
})
