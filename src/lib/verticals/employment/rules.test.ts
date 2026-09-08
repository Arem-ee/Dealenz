import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { selectRelevantFindings } from "@/lib/rules/result"
import { attachEvidence } from "@/lib/evidence"
import { applyUserConfirmation, seedEnvelopeForDealType } from "@/lib/context"
import type { RuleInput } from "@/lib/rules/schema"
import { EMPLOYMENT_RULES, registerEmploymentPack, resetEmploymentRegistration } from "./rules"
import { deriveEmploymentFacts } from "./facts"
import { registerFreelancePack, resetFreelanceRegistration } from "@/lib/verticals/freelance/rules"
import { registerLeasePack, resetLeaseRegistration } from "@/lib/verticals/lease/rules"
import { registerPurchaseSalePack, resetPurchaseSaleRegistration } from "@/lib/verticals/purchase_sale/rules"
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

function employmentInput(
  rawText: string,
  data: ExtractedData,
  source?: { type: "audit_input" | "conversation_input"; id: string | null }
): RuleInput {
  const envelope = applyUserConfirmation(seedEnvelopeForDealType("employment"), {
    userRole: { value: "employee" },
    counterpartyRole: { value: "employer" },
  })
  return {
    context: envelope,
    facts: {
      employment: JSON.parse(JSON.stringify(deriveEmploymentFacts(data, rawText, source))) as unknown,
    },
    knowledge: [],
    operation: "document_analysis",
    evaluatedAt: "2026-09-04T00:00:00.000Z",
  }
}

beforeEach(() => {
  clearRegistry()
  resetEmploymentRegistration()
})

describe("employment rule pack", () => {
  it("discovers scoped employment rules with honest authority", () => {
    registerEmploymentPack()
    registerEmploymentPack()
    expect(EMPLOYMENT_RULES.length).toBeGreaterThanOrEqual(5)
    expect(EMPLOYMENT_RULES.length).toBeLessThanOrEqual(12)
    for (const rule of EMPLOYMENT_RULES) {
      expect(rule.scope.dealTypes).toEqual(["employment"])
      expect(rule.status).toBe("active")
      expect(rule.authority.kind).toBe("product_policy")
    }
    expect(JSON.stringify(EMPLOYMENT_RULES)).not.toMatch(/statute|case law|illegal/i)
  })

  it("fires each employment absence rule when its predicate is satisfied on empty input", () => {
    registerEmploymentPack()
    const run = evaluateApplicableRules(employmentInput("", extracted()), "document_analysis", "employment")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("employment-compensation-missing")).toBe("FAIL")
    expect(byKey.get("employment-role-missing")).toBe("FAIL")
    expect(byKey.get("employment-commencement-missing")).toBe("FAIL")
    expect(byKey.get("employment-term-missing")).toBe("FAIL")
    expect(byKey.get("employment-duties-missing")).toBe("FAIL")
    expect(byKey.get("employment-probation-missing")).toBe("FAIL")
    expect(byKey.get("employment-termination-missing")).toBe("FAIL")
  })

  it("passes when the employment states the key terms", () => {
    registerEmploymentPack()
    const raw =
      "Role: Senior Engineer reporting to CTO. Compensation $90,000 per annum paid monthly. Commencement 1 March 2026. Term permanent. Duties include building product features and mentoring. Probation 3 months. Termination on 4 weeks notice. Employee liable for misconduct with liability capped at one month pay."
    const run = evaluateApplicableRules(
      employmentInput(raw, extracted({ budget: "$90,000" })),
      "document_analysis",
      "employment"
    )
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("employment-compensation-missing")).toBe("PASS")
    expect(byKey.get("employment-role-missing")).toBe("PASS")
    expect(byKey.get("employment-commencement-missing")).toBe("PASS")
    expect(byKey.get("employment-term-missing")).toBe("PASS")
    expect(byKey.get("employment-duties-missing")).toBe("PASS")
    expect(byKey.get("employment-probation-missing")).toBe("PASS")
    expect(byKey.get("employment-termination-missing")).toBe("PASS")
    // liability uncapped should be PASS when capped
    expect(byKey.get("employment-liability-uncapped")).toBe("PASS")
    const selected = selectRelevantFindings(run.results, { operation: "document_analysis" })
    expect(selected.every((f) => f.summary.length > 0)).toBe(true)
  })

  it("flags liability uncapped when liability appears without a cap", () => {
    registerEmploymentPack()
    const raw =
      "Role: Analyst. Compensation $50,000 per annum. Commencement 1 May 2026. Employee is liable for all losses and indemnifies employer with no cap."
    const run = evaluateApplicableRules(employmentInput(raw, extracted({ budget: "$50,000" })), "document_analysis", "employment")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("employment-liability-uncapped")).toBe("FAIL")
  })

  it("passes liability-uncapped when no liability language exists", () => {
    registerEmploymentPack()
    const raw = "Role: Designer. Compensation $60,000. Commencement 1 June 2026. Term permanent. Duties design. Probation 3 months. Termination 4 weeks notice."
    const run = evaluateApplicableRules(employmentInput(raw, extracted({ budget: "$60,000" })), "document_analysis", "employment")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("employment-liability-uncapped")).toBe("PASS")
  })

  it("keeps employment rules off other deal types and vice versa", () => {
    resetFreelanceRegistration()
    resetLeaseRegistration()
    resetPurchaseSaleRegistration()
    registerFreelancePack()
    registerLeasePack()
    registerPurchaseSalePack()
    registerEmploymentPack()
    const empRun = evaluateApplicableRules(employmentInput("Employment offer.", extracted()), "document_analysis", "employment")
    const empKeys = empRun.results.map((r) => r.ruleKey)
    expect(empKeys.some((k) => k.startsWith("employment-"))).toBe(true)
    expect(empKeys.some((k) => k.startsWith("freelance-"))).toBe(false)
    expect(empKeys.some((k) => k.startsWith("lease-"))).toBe(false)
    expect(empKeys.some((k) => k.startsWith("purchase-"))).toBe(false)

    const freelanceRun = evaluateApplicableRules(employmentInput("Employment offer.", extracted()), "document_analysis", "freelance")
    const fKeys = freelanceRun.results.map((r) => r.ruleKey)
    expect(fKeys.some((k) => k.startsWith("freelance-"))).toBe(true)
    expect(fKeys.some((k) => k.startsWith("employment-"))).toBe(false)

    const leaseRun = evaluateApplicableRules(employmentInput("Employment offer.", extracted()), "document_analysis", "lease")
    const lKeys = leaseRun.results.map((r) => r.ruleKey)
    expect(lKeys.some((k) => k.startsWith("lease-"))).toBe(true)
    expect(lKeys.some((k) => k.startsWith("employment-"))).toBe(false)

    const psRun = evaluateApplicableRules(employmentInput("Employment offer.", extracted()), "document_analysis", "purchase_sale")
    const pKeys = psRun.results.map((r) => r.ruleKey)
    expect(pKeys.some((k) => k.startsWith("purchase-"))).toBe(true)
    expect(pKeys.some((k) => k.startsWith("employment-"))).toBe(false)
  })

  it("runs no employment rules on unknown or generic deal types", () => {
    registerEmploymentPack()
    const unknownRun = evaluateApplicableRules(employmentInput("Employment offer.", extracted()), "document_analysis", "unknown")
    expect(unknownRun.results).toEqual([])
    const genericRun = evaluateApplicableRules(employmentInput("Employment offer.", extracted()), "document_analysis", "generic")
    expect(genericRun.results.filter((r) => r.ruleKey.startsWith("employment-"))).toEqual([])
  })

  it("preserves UNKNOWN and produces no numeric scores", () => {
    registerEmploymentPack()
    const run = evaluateApplicableRules(employmentInput("", extracted()), "document_analysis", "employment")
    for (const result of run.results) {
      expect(result).not.toHaveProperty("score")
      expect(["PASS", "FAIL", "UNKNOWN"]).toContain(result.status)
    }
    expect(JSON.stringify(run.results)).not.toMatch(/overallRisk|dealScore|riskScore/)
  })

  it("evaluates deterministically", () => {
    registerEmploymentPack()
    const input = employmentInput("Role: Engineer. Compensation $80,000. Commencement 1 Jan 2026.", extracted({ budget: "$80,000" }))
    const first = evaluateApplicableRules(input, "document_analysis", "employment")
    const second = evaluateApplicableRules(JSON.parse(JSON.stringify(input)) as RuleInput, "document_analysis", "employment")
    expect(second).toEqual(first)
  })

  it("carries evidence from fact to rule to finding end to end", () => {
    registerEmploymentPack()
    const rawLiab = "Role: Analyst. Compensation $50,000. Commencement 1 May 2026. Employee is liable for all losses with no cap."
    const liabInput = employmentInput(rawLiab, extracted({ budget: "$50,000" }))
    const liabRun = evaluateApplicableRules(liabInput, "document_analysis", "employment")
    const liabEnriched = attachEvidence(liabRun.results, liabInput, "document_analysis", "employment")
    const hit = liabEnriched.find((r) => r.ruleKey === "employment-liability-uncapped")
    expect(hit?.status).toBe("FAIL")
    const evidence = hit?.finding?.evidence ?? []
    expect(evidence.length).toBeGreaterThan(0)
    expect(evidence[0].observationKey).toBe("facts.employment.liability")
    expect(evidence[0].quote).toMatch(/liab/i)
    expect(evidence[0].location.kind).toBe("approximate")

    const missingInput = employmentInput("Just hello", extracted())
    const missingRun = evaluateApplicableRules(missingInput, "document_analysis", "employment")
    const missingEnriched = attachEvidence(missingRun.results, missingInput, "document_analysis", "employment")
    const miss = missingEnriched.find((r) => r.ruleKey === "employment-compensation-missing")
    expect(miss?.status).toBe("FAIL")
    expect(miss?.finding?.evidence ?? []).toEqual([])
  })

  it("carries exact evidence when the source is an inspectable audit", () => {
    registerEmploymentPack()
    const rawText = "Role: Engineer. Compensation $80,000. Employee is liable for defects with no cap stated."
    const input = employmentInput(rawText, extracted({ budget: "$80,000" }), { type: "audit_input", id: "audit-emp-1" })
    const run = evaluateApplicableRules(input, "document_analysis", "employment")
    const enriched = attachEvidence(run.results, input, "document_analysis", "employment")
    const hit = enriched.find((r) => r.ruleKey === "employment-liability-uncapped")
    expect(hit?.status).toBe("FAIL")
    const evidence = hit?.finding?.evidence ?? []
    expect(evidence.length).toBeGreaterThan(0)
    expect(evidence[0].location.kind).toBe("exact")
    expect(evidence[0].sourceId).toBe("audit-emp-1")
    const location = evidence[0].location
    if (location.kind === "exact") {
      expect(rawText.slice(location.startOffset, location.endOffset)).toMatch(/liab/i)
    } else {
      throw new Error("expected exact location")
    }
  })
})
