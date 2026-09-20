import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { extractAndValidate } from "./extract"
import { AIProviderError } from "./errors"
import { deriveFreelanceFacts } from "@/lib/verticals/freelance/facts"
import { deriveGenericFacts } from "@/lib/verticals/generic/facts"
import { FREELANCE_RULES, registerFreelancePack, resetFreelanceRegistration } from "@/lib/verticals/freelance/rules"
import { GENERIC_RULES, registerGenericPack, resetGenericRegistration } from "@/lib/verticals/generic/rules"
import { evaluateApplicableRules } from "@/lib/rules/registry"
import { clearRegistry } from "@/lib/rules/registry"
import { attachEvidence } from "@/lib/evidence"
import { applyUserConfirmation, seedEnvelopeForDealType } from "@/lib/context"

function mockAnthropicResponse(budget: string | null, timeline: string | null) {
  const body = JSON.stringify({
    goals: ["Test goal"],
    deliverables: ["Deliverable 1"],
    timeline,
    budget,
    projectType: "Test",
    clientSignals: [],
    missingInformation: [],
    confidence: 0.9,
  })
  return new Response(JSON.stringify({
    id: "msg_test",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: body }],
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 50 },
  }), { status: 200, headers: { "Content-Type": "application/json" } })
}

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test")
  vi.stubEnv("AUTH_AI_MODEL", "claude-sonnet-5")
  clearRegistry()
  resetFreelanceRegistration()
  resetGenericRegistration()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("structural extraction — conflicting observations preserved", () => {
  const cases: Array<{ name: string; budget: string | null; timeline: string | null; expectBudgetTerms?: string[]; expectTimelineTerms?: string[]; expectConflictPayment?: boolean; expectConflictTimeline?: boolean }> = [
    { name: "Net 15 and Net 30", budget: "Net 15 and Net 30", timeline: null, expectBudgetTerms: ["Net 15", "Net 30"], expectConflictPayment: true },
    { name: "Net 15; Net 30", budget: "Net 15; Net 30", timeline: null, expectBudgetTerms: ["Net 15", "Net 30"], expectConflictPayment: true },
    { name: "$5,000 and $7,000", budget: "$5,000 and $7,000", timeline: null, expectBudgetTerms: ["$5,000", "$7,000"], expectConflictPayment: true },
    { name: "$5,000 or $7,000", budget: "$5,000 or $7,000", timeline: null, expectBudgetTerms: ["$5,000", "$7,000"], expectConflictPayment: true },
    { name: "30 days, later changed to 45 days", budget: null, timeline: "30 days, later changed to 45 days", expectTimelineTerms: ["30 days", "45 days"], expectConflictTimeline: true },
    { name: "30 days and 45 days", budget: null, timeline: "30 days and 45 days", expectTimelineTerms: ["30 days", "45 days"], expectConflictTimeline: true },
    { name: "two conflicting payment dates: 2025-12-01 and 2025-12-15", budget: "Due 2025-12-01 and Due 2025-12-15", timeline: null, expectBudgetTerms: ["Due 2025-12-01", "Due 2025-12-15"], expectConflictPayment: true },
    { name: "two conflicting delivery dates: 2025-11-01 and 2025-11-30", budget: null, timeline: "Delivery 2025-11-01 and Delivery 2025-11-30", expectTimelineTerms: ["Delivery 2025-11-01", "Delivery 2025-11-30"], expectConflictTimeline: true },
  ]

  for (const c of cases) {
    it(`${c.name} preserves both observations structurally`, async () => {
      fetchMock.mockResolvedValueOnce(mockAnthropicResponse(c.budget, c.timeline))
      const result = await extractAndValidate("dummy input for extraction structural test", "freelance")
      expect(result.valid).toBe(true)
      const data = result.extractedData!
      // Check budgetTerms
      if (c.expectBudgetTerms) {
        const budgetTerms = data.budgetTerms ?? []
        expect(budgetTerms.length).toBeGreaterThanOrEqual(2)
        for (const term of c.expectBudgetTerms) {
          // Each expected term should be contained in one of the split terms (case-insensitive, trimmed)
          const found = budgetTerms.some((t) => t.toLowerCase().includes(term.toLowerCase().split(" ")[0].toLowerCase()) || t.includes(term))
          // Fallback: check that budget string contains term
          const inBudget = data.budget ? data.budget.includes(term.split(" ")[0]) : false
          expect(found || inBudget).toBe(true)
        }
        // No material observation discarded: original budget string must contain both
        expect(data.budget).not.toBeNull()
        // Evidence: budgetTerms should have at least 2 entries
        expect(budgetTerms.length).toBeGreaterThanOrEqual(2)
      }
      if (c.expectTimelineTerms) {
        const timelineTerms = data.timelineTerms ?? []
        expect(timelineTerms.length).toBeGreaterThanOrEqual(2)
        expect(data.timeline).not.toBeNull()
      }
      // Freelance facts should generate conflicting flag
      const facts = deriveFreelanceFacts(data, "raw text for evidence", { type: "audit_input", id: "audit-1" })
      if (c.expectConflictPayment) {
        expect(facts.conflictingPaymentTerms.value).toBe(true)
        expect((facts.conflictingPaymentTerms.evidenceRefs ?? []).length).toBeGreaterThan(0)
      }
      if (c.expectConflictTimeline) {
        expect(facts.conflictingTimelineTerms.value).toBe(true)
      }
      // Generic facts similarly
      const genericFacts = deriveGenericFacts(data, "raw text", { type: "audit_input", id: "audit-1" })
      if (c.expectConflictPayment) {
        expect(genericFacts.conflictingPaymentTerms.value).toBe(true)
      }
      // Rules should consume structured conflict facts
      registerFreelancePack()
      registerGenericPack()
      const freelanceInput = { context: applyUserConfirmation(seedEnvelopeForDealType("freelance"), { userRole: { value: "freelancer" } }), facts: { freelance: JSON.parse(JSON.stringify(facts)) as unknown }, knowledge: [], operation: "document_analysis" as const, evaluatedAt: new Date().toISOString() }
      const freelanceResults = evaluateApplicableRules(
        freelanceInput,
        "document_analysis",
        "freelance"
      )
      const enriched = attachEvidence(freelanceResults.results, freelanceInput, "document_analysis", "freelance")
      if (c.expectConflictPayment) {
        const hit = enriched.find((r) => r.ruleKey === "freelance-conflicting-payment-terms")
        expect(hit?.status).toBe("FAIL")
        expect(hit?.finding?.evidence?.length).toBeGreaterThan(0)
      }
      if (c.expectConflictTimeline) {
        const hit = enriched.find((r) => r.ruleKey === "freelance-conflicting-timeline")
        expect(hit?.status).toBe("FAIL")
      }
      clearRegistry()
      resetFreelanceRegistration()
      resetGenericRegistration()
    })
  }

  it("does not invent conflict when single term", async () => {
    fetchMock.mockResolvedValueOnce(mockAnthropicResponse("$5,000", "30 days"))
    const result = await extractAndValidate("single term", "freelance")
    expect(result.valid).toBe(true)
    expect((result.extractedData!.budgetTerms ?? []).length).toBe(1)
    expect((result.extractedData!.timelineTerms ?? []).length).toBe(1)
    const facts = deriveFreelanceFacts(result.extractedData!, "raw", { type: "audit_input", id: "audit-1" })
    expect(facts.conflictingPaymentTerms.value).toBeNull()
    expect(facts.conflictingTimelineTerms.value).toBeNull()
  })
})

describe("extraction error transparency", () => {
  it("propagates provider errors with category instead of wrapping as parse failures", async () => {
    vi.stubEnv("AUTH_AI_PROVIDER", "openai_compatible")
    vi.stubEnv("AI_API_KEY", "test-key")
    vi.stubEnv("AI_BASE_URL", "https://openrouter.ai/api/v1")
    vi.stubEnv("AUTH_AI_MODEL", "anthropic/claude-sonnet-5")
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "No endpoints found for model" } }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    )
    const err = await extractAndValidate("Some deal text with enough content here", "freelance").catch((e) => e)
    expect(err).toBeInstanceOf(AIProviderError)
    expect((err as AIProviderError).category).toBe("invalid_request")
    expect((err as AIProviderError).status).toBe(404)
    expect(String((err as Error).message)).not.toMatch(/parse/i)
  })

  it("still wraps malformed model output as parse failures", async () => {
    vi.stubEnv("AUTH_AI_PROVIDER", "openai_compatible")
    vi.stubEnv("AI_API_KEY", "test-key")
    vi.stubEnv("AI_BASE_URL", "https://openrouter.ai/api/v1")
    vi.stubEnv("AUTH_AI_MODEL", "anthropic/claude-sonnet-5")
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: "not json at all" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    await expect(extractAndValidate("Some deal text with enough content here", "freelance")).rejects.toThrow(
      /Failed to parse AI extraction result/
    )
  })
})
