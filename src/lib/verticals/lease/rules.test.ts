import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { selectRelevantFindings } from "@/lib/rules/result"
import { attachEvidence } from "@/lib/evidence"
import { applyUserConfirmation, seedEnvelopeForDealType } from "@/lib/context"
import type { RuleInput } from "@/lib/rules/schema"
import { LEASE_RULES, registerLeasePack, resetLeaseRegistration } from "./rules"
import { deriveLeaseFacts } from "./facts"
import { registerFreelancePack, resetFreelanceRegistration } from "@/lib/verticals/freelance/rules"
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

function leaseInput(
  rawText: string,
  data: ExtractedData,
  source?: { type: "audit_input" | "conversation_input"; id: string | null }
): RuleInput {
  const envelope = applyUserConfirmation(seedEnvelopeForDealType("lease"), {
    userRole: { value: "tenant" },
    counterpartyRole: { value: "landlord" },
  })
  return {
    context: envelope,
    facts: { lease: JSON.parse(JSON.stringify(deriveLeaseFacts(data, rawText, source))) as unknown },
    knowledge: [],
    operation: "document_analysis",
    evaluatedAt: "2026-09-04T00:00:00.000Z",
  }
}

beforeEach(() => {
  clearRegistry()
  resetLeaseRegistration()
})

describe("lease rule pack", () => {
  it("discovers scoped lease rules with honest authority", () => {
    registerLeasePack()
    registerLeasePack()
    expect(LEASE_RULES.length).toBeGreaterThanOrEqual(5)
    expect(LEASE_RULES.length).toBeLessThanOrEqual(10)
    for (const rule of LEASE_RULES) {
      expect(rule.scope.dealTypes).toEqual(["lease"])
      expect(rule.status).toBe("active")
      expect(rule.authority.kind).toBe("product_policy")
    }
    expect(JSON.stringify(LEASE_RULES)).not.toMatch(/statute|case law|illegal/i)
  })

  it("fires each initial rule when its predicate is satisfied", () => {
    registerLeasePack()
    const run = evaluateApplicableRules(leaseInput("", extracted()), "document_analysis", "lease")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("lease-rent-terms-missing")).toBe("FAIL")
    expect(byKey.get("lease-term-missing")).toBe("FAIL")
    expect(byKey.get("lease-termination-notice-missing")).toBe("FAIL")
    expect(byKey.get("lease-deposit-missing")).toBe("FAIL")
    expect(byKey.get("lease-maintenance-unclear")).toBe("FAIL")
    expect(byKey.get("lease-rent-review-unclear")).toBe("FAIL")
    expect(byKey.get("lease-permitted-use-unclear")).toBe("FAIL")
  })

  it("passes when the lease states the key terms", () => {
    registerLeasePack()
    const run = evaluateApplicableRules(
      leaseInput(
        "$2,400 monthly rent. 12-month lease term. Break clause with 3 months notice. $500 security deposit. Tenant handles maintenance and repairs. Annual market rent review. Permitted use as office. Subletting requires landlord consent.",
        extracted({ budget: "$2,400 per month" })
      ),
      "document_analysis",
      "lease"
    )
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("lease-rent-terms-missing")).toBe("PASS")
    expect(byKey.get("lease-term-missing")).toBe("PASS")
    expect(byKey.get("lease-termination-notice-missing")).toBe("PASS")
    expect(byKey.get("lease-deposit-missing")).toBe("PASS")
    expect(byKey.get("lease-maintenance-unclear")).toBe("PASS")
    expect(byKey.get("lease-subletting-terms-present")).toBe("FAIL")
    const selected = selectRelevantFindings(run.results, { operation: "document_analysis" })
    expect(selected.every((f) => f.summary.length > 0)).toBe(true)
  })

  it("keeps freelance rules off lease deals and lease rules off freelance deals", () => {
    resetFreelanceRegistration()
    registerFreelancePack()
    registerLeasePack()
    const leaseRun = evaluateApplicableRules(leaseInput("Shop lease.", extracted()), "document_analysis", "lease")
    const leaseKeys = leaseRun.results.map((r) => r.ruleKey)
    expect(leaseKeys.some((k) => k.startsWith("lease-"))).toBe(true)
    expect(leaseKeys.some((k) => k.startsWith("freelance-"))).toBe(false)
    const freelanceRun = evaluateApplicableRules(leaseInput("Shop lease.", extracted()), "document_analysis", "freelance")
    const freelanceKeys = freelanceRun.results.map((r) => r.ruleKey)
    expect(freelanceKeys.some((k) => k.startsWith("freelance-"))).toBe(true)
    expect(freelanceKeys.some((k) => k.startsWith("lease-"))).toBe(false)
  })

  it("runs no lease rules on unknown deal types", () => {
    registerLeasePack()
    const run = evaluateApplicableRules(leaseInput("Shop lease.", extracted()), "document_analysis", "unknown")
    expect(run.results).toEqual([])
  })

  it("preserves UNKNOWN and produces no numeric scores", () => {
    registerLeasePack()
    const run = evaluateApplicableRules(leaseInput("", extracted()), "document_analysis", "lease")
    for (const result of run.results) {
      expect(result).not.toHaveProperty("score")
      expect(["PASS", "FAIL", "UNKNOWN"]).toContain(result.status)
    }
    expect(JSON.stringify(run.results)).not.toMatch(/overallRisk|dealScore|riskScore/)
  })

  it("evaluates deterministically", () => {
    registerLeasePack()
    const input = leaseInput("12-month lease. $1000 monthly rent.", extracted())
    const first = evaluateApplicableRules(input, "document_analysis", "lease")
    const second = evaluateApplicableRules(
      JSON.parse(JSON.stringify(input)) as RuleInput,
      "document_analysis",
      "lease"
    )
    expect(second).toEqual(first)
  })

  it("carries evidence from fact to rule to finding end to end", () => {
    registerLeasePack()
    const input = leaseInput("12-month shop lease. Subletting requires landlord consent.", extracted())
    const run = evaluateApplicableRules(input, "document_analysis", "lease")
    const enriched = attachEvidence(run.results, input, "document_analysis", "lease")
    // Presence FAIL carries the observed evidence with quote and section.
    const hit = enriched.find((r) => r.ruleKey === "lease-subletting-terms-present")
    expect(hit?.status).toBe("FAIL")
    const evidence = hit?.finding?.evidence ?? []
    expect(evidence.length).toBeGreaterThan(0)
    expect(evidence[0].observationKey).toBe("facts.lease.subletting")
    expect(evidence[0].quote).toMatch(/sublet/i)
    expect(evidence[0].location.kind).toBe("approximate")
    // Absence FAIL carries no evidence: nothing was observed, and nothing
    // is manufactured to fill the field.
    const missing = enriched.find((r) => r.ruleKey === "lease-rent-terms-missing")
    expect(missing?.status).toBe("FAIL")
    expect(missing?.finding?.evidence ?? []).toEqual([])
  })

  it("carries exact evidence when the source is an inspectable audit", () => {
    registerLeasePack()
    const rawText = "12-month shop lease. Tenant liable for all repairs with no cap stated."
    const input = leaseInput(rawText, extracted(), { type: "audit_input", id: "audit-9" })
    const run = evaluateApplicableRules(input, "document_analysis", "lease")
    const enriched = attachEvidence(run.results, input, "document_analysis", "lease")
    const hit = enriched.find((r) => r.ruleKey === "lease-liability-uncapped")
    expect(hit?.status).toBe("FAIL")
    const evidence = hit?.finding?.evidence ?? []
    expect(evidence.length).toBeGreaterThan(0)
    expect(evidence[0].location.kind).toBe("exact")
    expect(evidence[0].sourceId).toBe("audit-9")
    const location = evidence[0].location
    if (location.kind === "exact") {
      expect(rawText.slice(location.startOffset, location.endOffset)).toMatch(/liab/i)
    } else {
      throw new Error("expected exact location")
    }
  })
})
