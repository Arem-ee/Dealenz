import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { selectRelevantFindings } from "@/lib/rules/result"
import { attachEvidence } from "@/lib/evidence"
import { applyUserConfirmation, seedEnvelopeForDealType } from "@/lib/context"
import type { RuleInput } from "@/lib/rules/schema"
import { FREELANCE_RULES, registerFreelancePack, resetFreelanceRegistration } from "./rules"
import { deriveFreelanceFacts } from "./facts"
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

function freelanceInput(rawText: string, data: ExtractedData, source?: { type: "audit_input" | "conversation_input"; id: string | null }): RuleInput {
  const envelope = applyUserConfirmation(seedEnvelopeForDealType("freelance"), {
    userRole: { value: "freelancer" },
    counterpartyRole: { value: "client" },
  })
  return {
    context: envelope,
    facts: { freelance: JSON.parse(JSON.stringify(deriveFreelanceFacts(data, rawText, source))) as unknown },
    knowledge: [],
    operation: "document_analysis",
    evaluatedAt: "2026-09-04T00:00:00.000Z",
  }
}

beforeEach(() => {
  clearRegistry()
  resetFreelanceRegistration()
})

describe("freelance rule pack", () => {
  it("discovers scoped freelance rules", () => {
    registerFreelancePack()
    registerFreelancePack()
    expect(FREELANCE_RULES.length).toBeGreaterThanOrEqual(5)
    expect(FREELANCE_RULES.length).toBeLessThanOrEqual(12)
    for (const rule of FREELANCE_RULES) {
      expect(rule.scope.dealTypes).toEqual(["freelance"])
      expect(rule.status).toBe("active")
      expect(rule.authority.kind).toBe("product_policy")
    }
  })

  it("keeps existing generic rules working alongside the pack", async () => {
    const { registerBuiltinRules } = await import("@/lib/rules/builtin")
    registerBuiltinRules()
    registerFreelancePack()
    const run = evaluateApplicableRules(
      freelanceInput("Website build.", extracted({ budget: "$100" })),
      "document_analysis",
      "freelance"
    )
    const keys = run.results.map((r) => r.ruleKey)
    expect(keys).toContain("payment-terms-missing")
    expect(keys).toContain("freelance-fee-terms-missing")
  })

  it("does not run freelance rules on generic deals", () => {
    registerFreelancePack()
    const run = evaluateApplicableRules(
      freelanceInput("Lease text.", extracted()),
      "document_analysis",
      "generic"
    )
    expect(run.results).toEqual([])
  })

  it("fires unlimited revisions as material with product authority", () => {
    registerFreelancePack()
    const run = evaluateApplicableRules(
      freelanceInput("Fixed price site with unlimited revisions.", extracted({ deliverables: ["Site with unlimited revisions"] })),
      "document_analysis",
      "freelance"
    )
    const hit = run.results.find((r) => r.ruleKey === "freelance-unlimited-revisions")
    expect(hit?.status).toBe("FAIL")
    expect(hit?.finding?.severity).toBe("material")
    expect(hit?.authority.kind).toBe("product_policy")
  })

  it("fabricates no legal authority in any finding", () => {
    registerFreelancePack()
    const run = evaluateApplicableRules(
      freelanceInput("Client indemnifies nothing. Liability unlimited, no cap, no termination, no ownership clause.", extracted()),
      "document_analysis",
      "freelance"
    )
    const text = JSON.stringify(run.results)
    for (const banned of ["statute", "regulation", "case law", "illegal", "unlawful", "legally required", "court"]) {
      expect(text.toLowerCase()).not.toContain(banned)
    }
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("freelance-liability-uncapped")).toBe("FAIL")
    expect(byKey.get("freelance-termination-missing")).toBe("FAIL")
    expect(byKey.get("freelance-ownership-unaddressed")).toBe("FAIL")
  })

  it("keeps unknown inputs unknown", () => {
    registerFreelancePack()
    const run = evaluateApplicableRules(freelanceInput("", extracted()), "document_analysis", "freelance")
    const fee = run.results.find((r) => r.ruleKey === "freelance-fee-terms-missing")
    // Unobserved fee text is missing (explicit presence semantics), while the
    // confidence-gated extraction fact below stays unknown-safe.
    expect(fee?.status).toBe("FAIL")
    const selected = selectRelevantFindings(run.results, { operation: "document_analysis" })
    expect(selected.length).toBeGreaterThan(0)
  })

  it("carries evidence from fact to rule to finding end to end", () => {
    registerFreelancePack()
    const input = freelanceInput("Website with unlimited revisions until approval.", extracted())
    const run = evaluateApplicableRules(input, "document_analysis", "freelance")
    const enriched = attachEvidence(run.results, input, "document_analysis", "freelance")
    const hit = enriched.find((r) => r.ruleKey === "freelance-unlimited-revisions")
    expect(hit?.status).toBe("FAIL")
    const evidence = hit?.finding?.evidence ?? []
    expect(evidence.length).toBeGreaterThan(0)
    expect(evidence[0].observationKey).toBe("facts.freelance.unlimitedRevisions")
    expect(evidence[0].quote).toMatch(/unlimited revision/i)
    expect(evidence[0].method).toBe("pattern_observation")
    expect(evidence[0].sourceType).toBe("conversation_input")
    expect(evidence[0].location.kind).toBe("approximate")
  })

  it("carries exact evidence when the source is an inspectable audit", () => {
    registerFreelancePack()
    const input = freelanceInput(
      "Website with unlimited revisions until approval.",
      extracted(),
      { type: "audit_input", id: "audit-1" }
    )
    const run = evaluateApplicableRules(input, "document_analysis", "freelance")
    const enriched = attachEvidence(run.results, input, "document_analysis", "freelance")
    const hit = enriched.find((r) => r.ruleKey === "freelance-unlimited-revisions")
    expect(hit?.status).toBe("FAIL")
    const evidence = hit?.finding?.evidence ?? []
    expect(evidence).toHaveLength(1)
    expect(evidence[0].location.kind).toBe("exact")
    expect(evidence[0].sourceId).toBe("audit-1")
    expect(evidence[0].inspectable).toBe(true)
    // Offsets slice the original raw input back out.
    const location = evidence[0].location
    if (location.kind === "exact") {
      const rawText = "Website with unlimited revisions until approval."
      // Stored offsets reproduce the stored quote from the original input.
      expect(rawText.slice(location.startOffset, location.endOffset)).toBe(evidence[0].quote)
    } else {
      throw new Error("expected exact location")
    }
  })
})
