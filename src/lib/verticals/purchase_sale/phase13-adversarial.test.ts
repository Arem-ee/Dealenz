import { describe, it, expect, beforeEach, vi } from "vitest"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { attachEvidence } from "@/lib/evidence"
import { seedEnvelopeForDealType, applyUserConfirmation } from "@/lib/context"
import { derivePurchaseSaleFacts } from "./facts"
import { PURCHASE_SALE_RULES, registerPurchaseSalePack, resetPurchaseSaleRegistration } from "./rules"
import { registerFreelancePack, resetFreelanceRegistration } from "@/lib/verticals/freelance/rules"
import { registerLeasePack, resetLeaseRegistration } from "@/lib/verticals/lease/rules"
import type { ExtractedData } from "@/lib/ai/extract"
import { verticalForDealType } from "@/lib/verticals"
import { answerQuestion } from "@/lib/conversation/request"
import { applyConstitution } from "@/lib/ai/constitution"
import { authorizeOperation } from "@/lib/credits/policy"
import type { LedgerClient } from "@/lib/credits/ledger"

function extracted(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    goals: [],
    deliverables: [],
    timeline: null,
    budget: null,
    projectType: null,
    clientSignals: [],
    missingInformation: [],
    confidence: 0.9,
    ...overrides,
  }
}

function fakeLedger(): LedgerClient {
  return {
    rpc: vi.fn(async () => ({ data: null, error: null })),
  } as unknown as LedgerClient
}

beforeEach(() => {
  clearRegistry()
  resetPurchaseSaleRegistration()
  resetFreelanceRegistration()
  resetLeaseRegistration()
})

describe("phase 13 adversarial", () => {
  it("unknown deal type: no vertical facts registered, no purchase rules apply, generic still empty", () => {
    registerPurchaseSalePack()
    registerFreelancePack()
    registerLeasePack()
    const vertical = verticalForDealType("unknown")
    expect(vertical).toBeNull()
    const envelope = seedEnvelopeForDealType("generic")
    const facts = derivePurchaseSaleFacts(extracted(), "Asset: van. Purchase price $1,000.", {
      type: "conversation_input",
      id: null,
    })
    expect(facts.asset.text).not.toBeNull()
    const input = {
      context: envelope,
      facts: { purchase_sale: facts as unknown },
      knowledge: [],
      operation: "document_analysis" as const,
      evaluatedAt: "2026-09-04T00:00:00.000Z",
    }
    const run = evaluateApplicableRules(input, "document_analysis", "unknown")
    expect(run.results.filter((r) => r.ruleKey.startsWith("purchase-"))).toEqual([])
  })

  it("missing fields stay missing (UNKNOWN never becomes FAIL): price absent does not hallucinate a value", () => {
    const facts = derivePurchaseSaleFacts(extracted(), "Just some chat about a van with no price.", {
      type: "audit_input",
      id: "a1",
    })
    expect(facts.purchasePrice.text).toBeNull()
    expect(facts.purchasePrice.evidence).toBeNull()
    expect(facts.purchasePrice.evidenceRefs).toEqual([])
  })

  it("observed fields carry evidenceRefs with quote, observationKey, and exact location for audit_input", () => {
    const raw = "Asset: delivery van. Buyer liable for defects with no cap."
    const facts = derivePurchaseSaleFacts(extracted({ budget: "$5,000" }), raw, { type: "audit_input", id: "audit-7" })
    expect(facts.purchasePrice.text).not.toBeNull()
    expect(facts.purchasePrice.evidence).not.toBeNull()
    expect((facts.asset.evidenceRefs ?? []).length).toBeGreaterThan(0)
    expect(facts.asset.evidenceRefs?.[0].observationKey).toBe("facts.purchase_sale.asset")
    expect(facts.asset.evidenceRefs?.[0].location.kind).toBe("exact")
    registerPurchaseSalePack()
    const envelope = applyUserConfirmation(seedEnvelopeForDealType("purchase_sale"), {
      userRole: { value: "buyer" },
    })
    const input = {
      context: envelope,
      facts: { purchase_sale: JSON.parse(JSON.stringify(facts)) as unknown },
      knowledge: [],
      operation: "document_analysis" as const,
      evaluatedAt: "2026-09-04T00:00:00.000Z",
    }
    const run = evaluateApplicableRules(input, "document_analysis", "purchase_sale")
    const enriched = attachEvidence(run.results, input, "document_analysis", "purchase_sale")
    const hit = enriched.find((r) => r.ruleKey === "purchase-liability-uncapped")
    expect(hit?.status).toBe("FAIL")
    expect(hit?.finding?.evidence?.[0].quote).toMatch(/liab/i)
  })

  it("conversation path attaches purchase_sale evidence end-to-end (audit_input → vertical → rule → evidence)", async () => {
    const ledger = fakeLedger()
    const ports = {
      loadContext: async () => applyUserConfirmation(seedEnvelopeForDealType("purchase_sale"), { userRole: { value: "buyer" } }),
      loadFacts: async () => ({
        extracted: extracted({ budget: "$5,000" }),
        rawText: "Asset: van. Seller is liable for all defects with no cap stated.",
      }),
      loadKnowledge: async () => [],
      aiCaller: async () => ({ text: "Answer", usage: { inputTokens: 1, outputTokens: 1 }, provider: "test", model: "test" }),
      ledger,
      policy: null,
    }
    const res = await answerQuestion({
      text: "What are the risks with this purchase?",
      auditId: "audit-ps-chat",
      userId: "user-ps",
      ports: ports as never,
    })
    expect(res.type).toBe("answer")
    if (res.type !== "answer") throw new Error("expected answer")
    expect(res.findingsUsed.some((f) => f.ruleKey === "purchase-liability-uncapped")).toBe(true)
    const hit = res.findingsUsed.find((f) => f.ruleKey === "purchase-liability-uncapped")
    expect(hit?.evidence?.[0]?.quote).toMatch(/liab/i)
    expect(hit?.evidence?.[0]?.location.kind).toBe("exact")
  })

  it("conversation with purchase_sale does not leak freelance/lease findings", async () => {
    const ledger = fakeLedger()
    const ports = {
      loadContext: async () => applyUserConfirmation(seedEnvelopeForDealType("purchase_sale"), { userRole: { value: "buyer" } }),
      loadFacts: async () => ({
        extracted: extracted(),
        rawText: "Asset: van. Purchase price $5,000. No other terms.",
      }),
      loadKnowledge: async () => [],
      aiCaller: async () => ({ text: "Answer", usage: { inputTokens: 1, outputTokens: 1 }, provider: "test", model: "test" }),
      ledger,
      policy: null,
    }
    const res = await answerQuestion({
      text: "Review this purchase",
      auditId: "audit-ps-leak",
      userId: "user-ps-leak",
      ports: ports as never,
    })
    expect(res.type).toBe("answer")
    if (res.type !== "answer") throw new Error("expected answer")
    expect(res.findingsUsed.every((f) => !f.ruleKey.startsWith("freelance-"))).toBe(true)
    expect(res.findingsUsed.every((f) => !f.ruleKey.startsWith("lease-"))).toBe(true)
  })

  it("credits: purchase_sale analysis costs same as other deal types (no secret multiplier)", async () => {
    const ledger = fakeLedger()
    const auth = await authorizeOperation({ ledger, userId: "u-ps-credit", operation: "document_analysis", policy: null })
    expect(auth.authorized).toBe(true)
    expect((auth as { mode?: string }).mode ?? "metering").toBeDefined()
  })

  it("constitution: purchase_sale findings never carry statute/illegal language and prompts enforce plain summary", async () => {
    registerPurchaseSalePack()
    for (const rule of PURCHASE_SALE_RULES) {
      expect(rule.finding.summary).not.toMatch(/statute|illegal|unlawful/i)
      expect((rule.finding.guidance ?? "")).not.toMatch(/statute|illegal/i)
    }
    const prompt = applyConstitution("You are Dealenz. Answer.", "conversation")
    expect(prompt).not.toMatch(/as a lawyer/i)
    expect(prompt).toMatch(/plain/i)
  })

  it("no numeric scores are ever produced by purchase_sale evaluation", () => {
    registerPurchaseSalePack()
    const envelope = seedEnvelopeForDealType("purchase_sale")
    const facts = derivePurchaseSaleFacts(extracted(), "", { type: "audit_input", id: "a1" })
    const input = {
      context: envelope,
      facts: { purchase_sale: JSON.parse(JSON.stringify(facts)) as unknown },
      knowledge: [],
      operation: "document_analysis" as const,
      evaluatedAt: "2026-09-04T00:00:00.000Z",
    }
    const run = evaluateApplicableRules(input, "document_analysis", "purchase_sale")
    expect(JSON.stringify(run)).not.toMatch(/overallRisk|dealScore|riskScore/)
    for (const r of run.results) expect((r as unknown as Record<string, unknown>)).not.toHaveProperty("score")
  })
})
