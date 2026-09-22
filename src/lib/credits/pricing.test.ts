import { describe, it, expect } from "vitest"
import {
  ANALYSIS_CREDITS,
  CREDIT_PRICE_BRIEF,
  CREDIT_PRICE_STANDARD,
  CREDIT_PRICE_EXTENDED,
  DOCUMENT_CREDIT_COSTS,
  LAWYER_REQUEST_CREDITS,
  SIGNATURE_SEND_CREDITS,
  SIGNUP_GRANT_CREDITS,
  STANDARD_CREDIT_POLICY,
  UPLOAD_CREDITS,
  creditsForDocumentType,
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
    expect(STANDARD_CREDIT_POLICY.estimateMaxCredits("conversation")).toBe(CREDIT_PRICE_BRIEF)
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

  it("rescales tiers above any single document cost", () => {
    expect(CREDIT_PRICE_BRIEF).toBe(10)
    expect(CREDIT_PRICE_STANDARD).toBe(30)
    expect(CREDIT_PRICE_EXTENDED).toBe(100)
    const maxDoc = Math.max(...Object.values(DOCUMENT_CREDIT_COSTS))
    expect(CREDIT_PRICE_EXTENDED).toBeGreaterThan(maxDoc)
  })

  it("prices documents per family with a micro default", () => {
    expect(creditsForDocumentType("proposal")).toBe(25)
    expect(creditsForDocumentType("Proposal")).toBe(25)
    expect(creditsForDocumentType("sow")).toBe(35)
    expect(creditsForDocumentType("statement_of_work")).toBe(35)
    expect(creditsForDocumentType("contract")).toBe(45)
    expect(creditsForDocumentType("checklist")).toBe(20)
    expect(DOCUMENT_CREDIT_COSTS).toEqual({ proposal: 25, sow: 35, contract: 45, checklist: 20 })
    // Unknown families (protection_clause, outreach micro-drafts) stay micro.
    expect(creditsForDocumentType("protection_clause")).toBe(1)
    expect(creditsForDocumentType(undefined)).toBe(1)
    expect(creditsForDocumentType("")).toBe(1)
  })

  it("prices gated actions above the free-signup grant", () => {
    expect(SIGNUP_GRANT_CREDITS).toBe(10)
    expect(UPLOAD_CREDITS).toBe(15)
    expect(SIGNATURE_SEND_CREDITS).toBe(25)
    expect(LAWYER_REQUEST_CREDITS).toBe(15)
    // A never-purchased account (grant only) cannot afford any gated action.
    for (const cost of [UPLOAD_CREDITS, SIGNATURE_SEND_CREDITS, LAWYER_REQUEST_CREDITS]) {
      expect(cost).toBeGreaterThan(SIGNUP_GRANT_CREDITS)
    }
  })

  it("prices one analysis exactly at the signup grant: the first analysis is free", () => {
    expect(ANALYSIS_CREDITS).toBe(10)
    expect(ANALYSIS_CREDITS).toBe(SIGNUP_GRANT_CREDITS)
  })
})
