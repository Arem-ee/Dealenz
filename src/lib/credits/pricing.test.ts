import { describe, it, expect } from "vitest"
import {
  ANALYSIS_CREDITS,
  CLARIFICATION_CREDITS,
  CLARIFICATION_MAX_CHARS,
  COUNTERPARTY_RESOLVE_CREDITS,
  CREDIT_PRICE_BRIEF,
  CREDIT_PRICE_STANDARD,
  CREDIT_PRICE_EXTENDED,
  CREDIT_PRICE_QUICK,
  DOCUMENT_CREDIT_COSTS,
  LAWYER_REQUEST_CREDITS,
  SIGNATURE_SEND_CREDITS,
  SIGNUP_GRANT_CREDITS,
  STANDARD_CREDIT_POLICY,
  UPLOAD_CREDITS,
  creditsForDocumentType,
  isClarificationTurn,
  priceForAsk,
  priceForAskChars,
  priceForInputLength,
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
    expect(CREDIT_PRICE_BRIEF).toBe(2)
    expect(CREDIT_PRICE_STANDARD).toBe(6)
    expect(CREDIT_PRICE_EXTENDED).toBe(25)
    const maxDoc = Math.max(...Object.values(DOCUMENT_CREDIT_COSTS))
    expect(CREDIT_PRICE_EXTENDED).toBeGreaterThan(maxDoc)
  })

  it("prices documents per family with a micro default", () => {
    expect(creditsForDocumentType("proposal")).toBe(10)
    expect(creditsForDocumentType("Proposal")).toBe(10)
    expect(creditsForDocumentType("sow")).toBe(15)
    expect(creditsForDocumentType("statement_of_work")).toBe(15)
    expect(creditsForDocumentType("contract")).toBe(20)
    expect(creditsForDocumentType("checklist")).toBe(10)
    expect(DOCUMENT_CREDIT_COSTS).toEqual({ proposal: 10, sow: 15, contract: 20, checklist: 10 })
    // Unknown families (protection_clause, outreach micro-drafts) stay micro.
    expect(creditsForDocumentType("protection_clause")).toBe(1)
    expect(creditsForDocumentType(undefined)).toBe(1)
    expect(creditsForDocumentType("")).toBe(1)
  })

  it("prices small operations within the free-signup grant and large ones above it", () => {
    expect(SIGNUP_GRANT_CREDITS).toBe(10)
    expect(UPLOAD_CREDITS).toBe(5)
    expect(SIGNATURE_SEND_CREDITS).toBe(10)
    expect(LAWYER_REQUEST_CREDITS).toBe(10)
    // A never-purchased account can genuinely try the product: uploads,
    // signatures, and small answers fit inside the grant.
    for (const cost of [UPLOAD_CREDITS, SIGNATURE_SEND_CREDITS, LAWYER_REQUEST_CREDITS, CREDIT_PRICE_BRIEF, CREDIT_PRICE_STANDARD]) {
      expect(cost).toBeLessThanOrEqual(SIGNUP_GRANT_CREDITS)
    }
    // Large operations still require purchase.
    for (const cost of [DOCUMENT_CREDIT_COSTS.sow, DOCUMENT_CREDIT_COSTS.contract, CREDIT_PRICE_EXTENDED]) {
      expect(cost).toBeGreaterThan(SIGNUP_GRANT_CREDITS)
    }
  })

  it("prices the signup grant at two full analyses", () => {
    expect(ANALYSIS_CREDITS).toBe(5)
    expect(SIGNUP_GRANT_CREDITS / ANALYSIS_CREDITS).toBe(2)
  })

  it("prices counterparty research at standard with a micro resolution floor", () => {
    expect(priceForOperation("counterparty_research")).toBe(CREDIT_PRICE_STANDARD)
    expect(COUNTERPARTY_RESOLVE_CREDITS).toBe(1)
  })
})

describe("length-priced asking", () => {
  it("tiers material by characters, not provider tokens", () => {
    expect(priceForInputLength(0)).toBe(CREDIT_PRICE_QUICK)
    expect(priceForInputLength(280)).toBe(CREDIT_PRICE_QUICK)
    expect(priceForInputLength(281)).toBe(CREDIT_PRICE_BRIEF)
    expect(priceForInputLength(2000)).toBe(CREDIT_PRICE_BRIEF)
    expect(priceForInputLength(2001)).toBe(CREDIT_PRICE_STANDARD)
    expect(priceForInputLength(8000)).toBe(CREDIT_PRICE_STANDARD)
    expect(priceForInputLength(8001)).toBe(CREDIT_PRICE_EXTENDED)
    expect(CREDIT_PRICE_QUICK).toBe(1)
  })

  it("prices brief work purely by material", () => {
    // A basic question costs 1, not the flat brief 2.
    expect(priceForAsk("What does net 30 mean?", "conversation")).toBe(1)
    expect(priceForAskChars(22, "conversation")).toBe(1)
    expect(priceForAskChars(1500, "conversation")).toBe(CREDIT_PRICE_BRIEF)
    // A pasted contract on a brief question pays extended for the material.
    expect(priceForAskChars(20000, "conversation")).toBe(CREDIT_PRICE_EXTENDED)
  })

  it("never discounts standard and extended work below its tier", () => {
    // A short "draft my proposal" still pays the standard tier for the work.
    expect(priceForAsk("Draft my proposal", "decision_support")).toBe(CREDIT_PRICE_STANDARD)
    expect(priceForAskChars(10000, "decision_support")).toBe(CREDIT_PRICE_EXTENDED)
    expect(priceForAskChars(10000, "document_analysis")).toBe(CREDIT_PRICE_EXTENDED)
  })

  it("estimates and charges the same length-aware price", () => {
    expect(STANDARD_CREDIT_POLICY.estimateMaxCredits("conversation", 22)).toBe(1)
    expect(STANDARD_CREDIT_POLICY.estimateMaxCredits("conversation")).toBe(CREDIT_PRICE_BRIEF)
    const record = {
      operation: "conversation" as const, provider: "anthropic", model: "m",
      creditsConsumed: null, status: "success" as const, createdAt: new Date().toISOString(),
      inputChars: 22,
    }
    expect(STANDARD_CREDIT_POLICY.creditsForUsage(record)).toBe(1)
  })

  it("settles output down from the estimate, never up", () => {
    const recordFor = (inputChars: number, operation: "conversation" | "decision_support", outputTokens?: number) => ({
      operation, provider: "anthropic", model: "m",
      creditsConsumed: null, status: "success" as const, createdAt: new Date().toISOString(),
      inputChars, ...(outputTokens === undefined ? {} : { outputTokens }),
    })
    // Short standard question, concise answer: quoted 6, settled 1.
    expect(STANDARD_CREDIT_POLICY.creditsForUsage(recordFor(41, "decision_support", 120))).toBe(1)
    // Same question, full-length answer: quoted 6, settled 6.
    expect(STANDARD_CREDIT_POLICY.creditsForUsage(recordFor(41, "decision_support", 1800))).toBe(6)
    // Long input holds the charge even when the answer lands short.
    expect(STANDARD_CREDIT_POLICY.creditsForUsage(recordFor(5000, "decision_support", 120))).toBe(6)
    // Brief work settles at the input price regardless of output length.
    expect(STANDARD_CREDIT_POLICY.creditsForUsage(recordFor(22, "conversation", 900))).toBe(1)
    expect(STANDARD_CREDIT_POLICY.creditsForUsage(recordFor(1500, "conversation", 100))).toBe(2)
    // No telemetry, no discount: settles at the estimate.
    expect(STANDARD_CREDIT_POLICY.creditsForUsage(recordFor(41, "decision_support"))).toBe(6)
    // Provider input-token counts still never price anything — only the
    // character count and the measured output do.
    expect(
      STANDARD_CREDIT_POLICY.creditsForUsage({ ...recordFor(22, "conversation"), inputTokens: 9000, totalTokens: 9100 })
    ).toBe(1)
  })
})

describe("clarification rate", () => {
  it("prices short answers to the system's own question at 1 credit", () => {
    expect(CLARIFICATION_CREDITS).toBe(1)
    expect(STANDARD_CREDIT_POLICY.estimateMaxCredits("conversation")).toBe(CREDIT_PRICE_BRIEF)
  })

  it("qualifies a short answer directly following a single question", () => {
    const history = [
      { role: "user", text: "Review my contract" },
      { role: "assistant", text: "Where will the work be performed?" },
    ]
    expect(isClarificationTurn(history, "Lagos, Nigeria")).toBe(true)
  })

  it("rejects answers with their own question, long answers, and non-answers", () => {
    const history = [{ role: "assistant", text: "Where will the work be performed?" }]
    // A new question is not an answer.
    expect(isClarificationTurn(history, "Lagos — but what does governing law mean?")).toBe(false)
    // Essays are not clarifications.
    expect(isClarificationTurn(history, "x".repeat(CLARIFICATION_MAX_CHARS + 1))).toBe(false)
    expect(isClarificationTurn(history, "  ")).toBe(false)
    // No preceding question: no discount.
    expect(isClarificationTurn([], "Lagos, Nigeria")).toBe(false)
    expect(isClarificationTurn([{ role: "user", text: "hello" }], "Lagos")).toBe(false)
    // Statement, not a question: no discount.
    expect(isClarificationTurn([{ role: "assistant", text: "Got it. Moving on." }], "Lagos")).toBe(false)
    // Bombardment is not rewarded: multi-question turns pay full price.
    expect(isClarificationTurn([{ role: "assistant", text: "Where? When? How much?" }], "Lagos")).toBe(false)
  })
})
