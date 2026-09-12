import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { selectRelevantFindings } from "@/lib/rules/result"
import { attachEvidence } from "@/lib/evidence"
import { applyUserConfirmation, seedEnvelopeForDealType } from "@/lib/context"
import type { RuleInput } from "@/lib/rules/schema"
import { PARTNERSHIP_RULES, registerPartnershipPack, resetPartnershipRegistration } from "./rules"
import { derivePartnershipFacts } from "./facts"
import { registerFreelancePack, resetFreelanceRegistration } from "@/lib/verticals/freelance/rules"
import { registerLeasePack, resetLeaseRegistration } from "@/lib/verticals/lease/rules"
import { registerPurchaseSalePack, resetPurchaseSaleRegistration } from "@/lib/verticals/purchase_sale/rules"
import { registerEmploymentPack, resetEmploymentRegistration } from "@/lib/verticals/employment/rules"
import { registerFounderPack, resetFounderRegistration } from "@/lib/verticals/founder/rules"
import { registerGenericPack, resetGenericRegistration } from "@/lib/verticals/generic/rules"
import type { ExtractedData } from "@/lib/ai/extract"

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

function partnershipInput(
  rawText: string,
  data: ExtractedData,
  source?: { type: "audit_input" | "conversation_input"; id: string | null }
): RuleInput {
  const envelope = applyUserConfirmation(seedEnvelopeForDealType("partnership"), {
    userRole: { value: "partner" },
    counterpartyRole: { value: "partner" },
  })
  return {
    context: envelope,
    facts: {
      partnership: JSON.parse(JSON.stringify(derivePartnershipFacts(data, rawText, source))) as unknown,
    },
    knowledge: [],
    operation: "document_analysis",
    evaluatedAt: "2026-09-04T00:00:00.000Z",
  }
}

beforeEach(() => {
  clearRegistry()
  resetPartnershipRegistration()
})

describe("partnership rule pack", () => {
  it("discovers scoped partnership rules with honest authority", () => {
    registerPartnershipPack()
    registerPartnershipPack()
    expect(PARTNERSHIP_RULES.length).toBe(8)
    for (const rule of PARTNERSHIP_RULES) {
      expect(rule.scope.dealTypes).toEqual(["partnership"])
      expect(rule.status).toBe("active")
      expect(rule.authority.kind).toBe("product_policy")
    }
    expect(JSON.stringify(PARTNERSHIP_RULES)).not.toMatch(/statute|case law|illegal/i)
  })

  it("fires each partnership absence rule when its predicate is satisfied on empty input", () => {
    registerPartnershipPack()
    const run = evaluateApplicableRules(partnershipInput("", extracted()), "document_analysis", "partnership")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("partnership-ownership-split-missing")).toBe("FAIL")
    expect(byKey.get("partnership-contributions-missing")).toBe("FAIL")
    expect(byKey.get("partnership-profit-distribution-missing")).toBe("FAIL")
    expect(byKey.get("partnership-authority-unclear")).toBe("FAIL")
    expect(byKey.get("partnership-governance-deadlock")).toBe("FAIL")
    expect(byKey.get("partnership-exit-missing")).toBe("FAIL")
    expect(byKey.get("partnership-transfer-restriction-ambiguous")).toBe("FAIL")
    // liability uncapped needs liability present, empty has none so PASS
    expect(byKey.get("partnership-liability-uncapped")).toBe("PASS")
  })

  it("passes when the partnership agreement states the key terms", () => {
    registerPartnershipPack()
    const raw =
      "Alice is managing partner and Bob is limited partner. Profits split 60/40. Each partner contributes $50,000 in initial capital. Profits are distributed quarterly. The managing partner runs day-to-day operations. Decisions need a majority vote with reserved matters needing consent. A departing partner's interest is bought out at fair value. Transferring an interest needs the other partners' consent."
    const run = evaluateApplicableRules(partnershipInput(raw, extracted()), "document_analysis", "partnership")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("partnership-ownership-split-missing")).toBe("PASS")
    expect(byKey.get("partnership-contributions-missing")).toBe("PASS")
    expect(byKey.get("partnership-profit-distribution-missing")).toBe("PASS")
    expect(byKey.get("partnership-authority-unclear")).toBe("PASS")
    expect(byKey.get("partnership-governance-deadlock")).toBe("PASS")
    expect(byKey.get("partnership-exit-missing")).toBe("PASS")
    expect(byKey.get("partnership-transfer-restriction-ambiguous")).toBe("PASS")
    expect(byKey.get("partnership-liability-uncapped")).toBe("PASS")
    const selected = selectRelevantFindings(run.results, { operation: "document_analysis" })
    expect(selected.every((f) => f.summary.length > 0)).toBe(true)
  })

  it("flags liability uncapped when liability appears without a cap", () => {
    registerPartnershipPack()
    const raw = "Alice and Bob split profits 50/50. Partners are liable for all partnership debts with no cap."
    const run = evaluateApplicableRules(partnershipInput(raw, extracted()), "document_analysis", "partnership")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("partnership-liability-uncapped")).toBe("FAIL")
  })

  it("keeps partnership rules off other deal types and vice versa", () => {
    resetFreelanceRegistration()
    resetLeaseRegistration()
    resetPurchaseSaleRegistration()
    resetEmploymentRegistration()
    resetFounderRegistration()
    resetGenericRegistration()
    registerFreelancePack()
    registerLeasePack()
    registerPurchaseSalePack()
    registerEmploymentPack()
    registerFounderPack()
    registerGenericPack()
    registerPartnershipPack()
    const partnershipRun = evaluateApplicableRules(partnershipInput("Partnership deal.", extracted()), "document_analysis", "partnership")
    const pKeys = partnershipRun.results.map((r) => r.ruleKey)
    expect(pKeys.some((k) => k.startsWith("partnership-"))).toBe(true)
    expect(pKeys.some((k) => k.startsWith("freelance-"))).toBe(false)
    expect(pKeys.some((k) => k.startsWith("lease-"))).toBe(false)
    expect(pKeys.some((k) => k.startsWith("purchase-"))).toBe(false)
    expect(pKeys.some((k) => k.startsWith("employment-"))).toBe(false)
    expect(pKeys.some((k) => k.startsWith("founder-"))).toBe(false)
    expect(pKeys.some((k) => k.startsWith("generic-"))).toBe(false)

    const genericRun = evaluateApplicableRules(partnershipInput("Partnership deal.", extracted()), "document_analysis", "generic")
    const gKeys = genericRun.results.map((r) => r.ruleKey)
    expect(gKeys.some((k) => k.startsWith("generic-"))).toBe(true)
    expect(gKeys.some((k) => k.startsWith("partnership-"))).toBe(false)
  })

  it("runs no partnership rules on unknown deal types", () => {
    registerPartnershipPack()
    const unknownRun = evaluateApplicableRules(partnershipInput("Partnership deal.", extracted()), "document_analysis", "unknown")
    expect(unknownRun.results).toEqual([])
  })

  it("preserves UNKNOWN and produces no numeric scores", () => {
    registerPartnershipPack()
    const run = evaluateApplicableRules(partnershipInput("", extracted()), "document_analysis", "partnership")
    for (const result of run.results) {
      expect(result).not.toHaveProperty("score")
      expect(["PASS", "FAIL", "UNKNOWN"]).toContain(result.status)
    }
    expect(JSON.stringify(run.results)).not.toMatch(/overallRisk|dealScore|riskScore/)
  })

  it("evaluates deterministically", () => {
    registerPartnershipPack()
    const input = partnershipInput("50/50 profit split. $25,000 each in capital.", extracted())
    const first = evaluateApplicableRules(input, "document_analysis", "partnership")
    const second = evaluateApplicableRules(JSON.parse(JSON.stringify(input)) as RuleInput, "document_analysis", "partnership")
    expect(second).toEqual(first)
  })

  it("carries evidence from fact to rule to finding end to end", () => {
    registerPartnershipPack()
    const raw = "50/50 profit split. Partners are liable for all debts with no cap."
    const input = partnershipInput(raw, extracted())
    const run = evaluateApplicableRules(input, "document_analysis", "partnership")
    const enriched = attachEvidence(run.results, input, "document_analysis", "partnership")
    const hit = enriched.find((r) => r.ruleKey === "partnership-liability-uncapped")
    expect(hit?.status).toBe("FAIL")
    const evidence = hit?.finding?.evidence ?? []
    expect(evidence.length).toBeGreaterThan(0)
    expect(evidence[0].observationKey).toBe("facts.partnership.liability")
    expect(evidence[0].quote).toMatch(/liab/i)
  })
})
