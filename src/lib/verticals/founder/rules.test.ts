import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { selectRelevantFindings } from "@/lib/rules/result"
import { attachEvidence } from "@/lib/evidence"
import { applyUserConfirmation, seedEnvelopeForDealType } from "@/lib/context"
import type { RuleInput } from "@/lib/rules/schema"
import { FOUNDER_RULES, registerFounderPack, resetFounderRegistration } from "./rules"
import { deriveFounderFacts } from "./facts"
import { registerFreelancePack, resetFreelanceRegistration } from "@/lib/verticals/freelance/rules"
import { registerLeasePack, resetLeaseRegistration } from "@/lib/verticals/lease/rules"
import { registerPurchaseSalePack, resetPurchaseSaleRegistration } from "@/lib/verticals/purchase_sale/rules"
import { registerEmploymentPack, resetEmploymentRegistration } from "@/lib/verticals/employment/rules"
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

function founderInput(
  rawText: string,
  data: ExtractedData,
  source?: { type: "audit_input" | "conversation_input"; id: string | null }
): RuleInput {
  const envelope = applyUserConfirmation(seedEnvelopeForDealType("founder"), {
    userRole: { value: "founder" },
    counterpartyRole: { value: "cofounder" },
  })
  return {
    context: envelope,
    facts: {
      founder: JSON.parse(JSON.stringify(deriveFounderFacts(data, rawText, source))) as unknown,
    },
    knowledge: [],
    operation: "document_analysis",
    evaluatedAt: "2026-09-04T00:00:00.000Z",
  }
}

beforeEach(() => {
  clearRegistry()
  resetFounderRegistration()
})

describe("founder rule pack", () => {
  it("discovers scoped founder rules with honest authority", () => {
    registerFounderPack()
    registerFounderPack()
    expect(FOUNDER_RULES.length).toBe(8)
    for (const rule of FOUNDER_RULES) {
      expect(rule.scope.dealTypes).toEqual(["founder"])
      expect(rule.status).toBe("active")
      expect(rule.authority.kind).toBe("product_policy")
    }
    expect(JSON.stringify(FOUNDER_RULES)).not.toMatch(/statute|case law|illegal/i)
  })

  it("fires each founder absence rule when its predicate is satisfied on empty input", () => {
    registerFounderPack()
    const run = evaluateApplicableRules(founderInput("", extracted()), "document_analysis", "founder")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("founder-ownership-split-missing")).toBe("FAIL")
    expect(byKey.get("founder-vesting-missing")).toBe("FAIL")
    expect(byKey.get("founder-ip-assignment-missing")).toBe("FAIL")
    expect(byKey.get("founder-roles-unclear")).toBe("FAIL")
    expect(byKey.get("founder-governance-deadlock")).toBe("FAIL")
    expect(byKey.get("founder-leaver-missing")).toBe("FAIL")
    expect(byKey.get("founder-transfer-restriction-ambiguous")).toBe("FAIL")
    // liability uncapped needs liability present, empty has none so PASS
    expect(byKey.get("founder-liability-uncapped")).toBe("PASS")
  })

  it("passes when the founder agreement states the key terms", () => {
    registerFounderPack()
    const raw =
      "Alice is CEO and Bob is CTO. Ownership split 60/40. Four-year vesting with a one-year cliff. All IP is assigned to the company. Board decides by majority vote with reserved matters needing consent. Leaver shares are repurchased. Share transfers need board consent."
    const run = evaluateApplicableRules(founderInput(raw, extracted()), "document_analysis", "founder")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("founder-ownership-split-missing")).toBe("PASS")
    expect(byKey.get("founder-vesting-missing")).toBe("PASS")
    expect(byKey.get("founder-ip-assignment-missing")).toBe("PASS")
    expect(byKey.get("founder-roles-unclear")).toBe("PASS")
    expect(byKey.get("founder-governance-deadlock")).toBe("PASS")
    expect(byKey.get("founder-leaver-missing")).toBe("PASS")
    expect(byKey.get("founder-transfer-restriction-ambiguous")).toBe("PASS")
    expect(byKey.get("founder-liability-uncapped")).toBe("PASS")
    const selected = selectRelevantFindings(run.results, { operation: "document_analysis" })
    expect(selected.every((f) => f.summary.length > 0)).toBe(true)
  })

  it("flags liability uncapped when liability appears without a cap", () => {
    registerFounderPack()
    const raw = "Alice and Bob split ownership 50/50. Founders are liable for all company losses with no cap."
    const run = evaluateApplicableRules(founderInput(raw, extracted()), "document_analysis", "founder")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("founder-liability-uncapped")).toBe("FAIL")
  })

  it("keeps founder rules off other deal types and vice versa", () => {
    resetFreelanceRegistration()
    resetLeaseRegistration()
    resetPurchaseSaleRegistration()
    resetEmploymentRegistration()
    resetGenericRegistration()
    registerFreelancePack()
    registerLeasePack()
    registerPurchaseSalePack()
    registerEmploymentPack()
    registerGenericPack()
    registerFounderPack()
    const founderRun = evaluateApplicableRules(founderInput("Founder deal.", extracted()), "document_analysis", "founder")
    const fKeys = founderRun.results.map((r) => r.ruleKey)
    expect(fKeys.some((k) => k.startsWith("founder-"))).toBe(true)
    expect(fKeys.some((k) => k.startsWith("freelance-"))).toBe(false)
    expect(fKeys.some((k) => k.startsWith("lease-"))).toBe(false)
    expect(fKeys.some((k) => k.startsWith("purchase-"))).toBe(false)
    expect(fKeys.some((k) => k.startsWith("employment-"))).toBe(false)
    expect(fKeys.some((k) => k.startsWith("generic-"))).toBe(false)

    const genericRun = evaluateApplicableRules(founderInput("Founder deal.", extracted()), "document_analysis", "generic")
    const gKeys = genericRun.results.map((r) => r.ruleKey)
    expect(gKeys.some((k) => k.startsWith("generic-"))).toBe(true)
    expect(gKeys.some((k) => k.startsWith("founder-"))).toBe(false)
  })

  it("runs no founder rules on unknown deal types", () => {
    registerFounderPack()
    const unknownRun = evaluateApplicableRules(founderInput("Founder deal.", extracted()), "document_analysis", "unknown")
    expect(unknownRun.results).toEqual([])
  })

  it("preserves UNKNOWN and produces no numeric scores", () => {
    registerFounderPack()
    const run = evaluateApplicableRules(founderInput("", extracted()), "document_analysis", "founder")
    for (const result of run.results) {
      expect(result).not.toHaveProperty("score")
      expect(["PASS", "FAIL", "UNKNOWN"]).toContain(result.status)
    }
    expect(JSON.stringify(run.results)).not.toMatch(/overallRisk|dealScore|riskScore/)
  })

  it("evaluates deterministically", () => {
    registerFounderPack()
    const input = founderInput("50/50 ownership. Vesting over 4 years.", extracted())
    const first = evaluateApplicableRules(input, "document_analysis", "founder")
    const second = evaluateApplicableRules(JSON.parse(JSON.stringify(input)) as RuleInput, "document_analysis", "founder")
    expect(second).toEqual(first)
  })

  it("carries evidence from fact to rule to finding end to end", () => {
    registerFounderPack()
    const raw = "50/50 ownership. Founders are liable for all losses with no cap."
    const input = founderInput(raw, extracted())
    const run = evaluateApplicableRules(input, "document_analysis", "founder")
    const enriched = attachEvidence(run.results, input, "document_analysis", "founder")
    const hit = enriched.find((r) => r.ruleKey === "founder-liability-uncapped")
    expect(hit?.status).toBe("FAIL")
    const evidence = hit?.finding?.evidence ?? []
    expect(evidence.length).toBeGreaterThan(0)
    expect(evidence[0].observationKey).toBe("facts.founder.liability")
    expect(evidence[0].quote).toMatch(/liab/i)
  })
})
