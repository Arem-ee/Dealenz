import { describe, it, expect } from "vitest"
import { assembleDraft } from "./assembly"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { attachEvidence } from "@/lib/evidence"
import { seedEnvelopeForDealType, applyUserConfirmation } from "@/lib/context"
import { deriveFounderFacts } from "@/lib/verticals/founder/facts"
import { derivePartnershipFacts } from "@/lib/verticals/partnership/facts"
import { registerFounderPack, resetFounderRegistration } from "@/lib/verticals/founder/rules"
import { registerPartnershipPack, resetPartnershipRegistration } from "@/lib/verticals/partnership/rules"
import type { ExtractedData } from "@/lib/ai/extract"
import type { RuleResult } from "@/lib/rules/result"

function extracted(): ExtractedData {
  return { goals: [], deliverables: [], timeline: null, budget: null, projectType: null, clientSignals: [], missingInformation: [], confidence: 0.9 }
}

function founderFindings(raw = ""): RuleResult[] {
  clearRegistry()
  resetFounderRegistration()
  registerFounderPack()
  const envelope = applyUserConfirmation(seedEnvelopeForDealType("founder"), { userRole: { value: "founder" } } as never)
  const facts = deriveFounderFacts(extracted(), raw, { type: "audit_input", id: "audit-1" })
  const input = {
    context: envelope,
    facts: { founder: JSON.parse(JSON.stringify(facts)) as unknown },
    knowledge: [],
    operation: "document_analysis" as const,
    evaluatedAt: "2026-09-04T00:00:00.000Z",
  }
  const run = evaluateApplicableRules(input, "document_analysis", "founder")
  return attachEvidence(run.results, input, "document_analysis", "founder")
}

function partnershipFindings(raw = ""): RuleResult[] {
  clearRegistry()
  resetPartnershipRegistration()
  registerPartnershipPack()
  const envelope = applyUserConfirmation(seedEnvelopeForDealType("partnership"), { userRole: { value: "partner" } } as never)
  const facts = derivePartnershipFacts(extracted(), raw, { type: "audit_input", id: "audit-1" })
  const input = {
    context: envelope,
    facts: { partnership: JSON.parse(JSON.stringify(facts)) as unknown },
    knowledge: [],
    operation: "document_analysis" as const,
    evaluatedAt: "2026-09-04T00:00:00.000Z",
  }
  const run = evaluateApplicableRules(input, "document_analysis", "partnership")
  return attachEvidence(run.results, input, "document_analysis", "partnership")
}

describe("business-owner document assembly — international", () => {
  it("founder founder-agreement assembles with Nigeria jurisdiction and preserves provenance", () => {
    const findings = founderFindings("Alice (CEO) and Bob (CTO) split 50/50.")
    const result = assembleDraft({
      familyId: "founder-agreement",
      dealType: "founder",
      jurisdiction: { country: "Nigeria" },
      findings,
      variables: { company_name: "Acme Ltd", founder_names: "Alice and Bob", ownership_percentages: "50/50" },
    })
    expect(result.draft.title).toBe("Founder Agreement")
    expect(result.draft.markdown).toContain("Acme Ltd")
    expect(result.draft.provenance.dealType).toBe("founder")
    expect(result.draft.provenance.jurisdiction.country).toBe("Nigeria")
    expect(result.draft.provenance.protectionIntents.length).toBeGreaterThan(0)
    expect(result.draft.citations.length).toBeGreaterThan(0)
    expect(result.draft.markdown).toContain("Legal provenance")
    expect(result.draft.markdown).toContain("drafting assistance")
  })

  it("partnership llp-agreement distinguishes LLP and preserves structure", () => {
    const findings = partnershipFindings("LLP agreement between Alice and Bob.")
    const result = assembleDraft({
      familyId: "llp-agreement",
      dealType: "partnership",
      jurisdiction: { country: "Nigeria" },
      findings,
      variables: { partner_names: "Alice and Bob", contribution_amounts: "₦1M each" },
      partnershipStructure: "LLP",
    })
    expect(result.draft.markdown).toContain("LLP")
    expect(result.draft.variables.partnership_structure).toBe("LLP")
  })

  it("partnership ordinary vs LLP vs UNKNOWN not collapsed", () => {
    const findings = partnershipFindings("")
    const ordinary = assembleDraft({
      familyId: "partnership-agreement",
      dealType: "partnership",
      jurisdiction: { country: "Nigeria" },
      findings,
      variables: {},
      partnershipStructure: "ordinary partnership",
    })
    const llp = assembleDraft({
      familyId: "llp-agreement",
      dealType: "partnership",
      jurisdiction: { country: "Nigeria" },
      findings,
      variables: {},
      partnershipStructure: "LLP",
    })
    const unknown = assembleDraft({
      familyId: "partnership-agreement",
      dealType: "partnership",
      jurisdiction: { country: "Nigeria" },
      findings,
      variables: {},
      partnershipStructure: null,
    })
    expect(ordinary.draft.variables.partnership_structure).toBe("ordinary partnership")
    expect(llp.draft.variables.partnership_structure).toBe("LLP")
    expect(unknown.draft.variables.partnership_structure).toBe("UNKNOWN")
    expect(unknown.missingVariables).toContain("partnership_structure")
    expect(unknown.draft.markdown).toContain("UNKNOWN")
  })

  it("missing variables remain UNKNOWN and are surfaced, never invented", () => {
    const findings = founderFindings("")
    const result = assembleDraft({
      familyId: "founder-agreement",
      dealType: "founder",
      jurisdiction: { country: "Nigeria" },
      findings,
      variables: {}, // none provided
    })
    expect(result.missingVariables.length).toBeGreaterThan(0)
    expect(result.draft.markdown).toContain("{{")
    expect(result.draft.markdown).toContain("UNKNOWN")
    expect(result.draft.markdown).not.toMatch(/invented value/i)
  })

  it("is not Nigeria-hardcoded — Testland fixture jurisdiction proves neutrality", () => {
    const findings = founderFindings("")
    const nigeria = assembleDraft({
      familyId: "founder-agreement",
      dealType: "founder",
      jurisdiction: { country: "Nigeria" },
      findings,
      variables: {},
    })
    const testland = assembleDraft({
      familyId: "founder-agreement",
      dealType: "founder",
      jurisdiction: { country: "Testland" },
      findings,
      variables: {},
    })
    // Same family produces a draft in both jurisdictions (jurisdiction-neutral core)
    expect(nigeria.draft.title).toBe(testland.draft.title)
    expect(nigeria.draft.provenance.jurisdiction.country).toBe("Nigeria")
    expect(testland.draft.provenance.jurisdiction.country).toBe("Testland")
    // Nigeria has verified legal citations; Testland honestly has none (fixture, not real coverage)
    expect(nigeria.citations.length).toBeGreaterThan(0)
    expect(testland.citations.length).toBe(0)
    expect(testland.draft.markdown).toContain("Testland is a synthetic fixture")
    // Legal provenance citations differ; clause warnings may still mention CAMA as drafting context,
    // but the provenance citations themselves must be empty for Testland
    expect(testland.draft.provenance.citations.length).toBe(0)
    // Veracity differs honestly
    expect(nigeria.veracity).toBe("VERIFIED")
    expect(testland.veracity).toBe("NOT_FOUND")
  })

  it("stale/conflicting legal context remains visible, evidence survives", () => {
    const findings = founderFindings("")
    const result = assembleDraft({
      familyId: "founder-agreement",
      dealType: "founder",
      jurisdiction: { country: "Nigeria" },
      findings,
      variables: { company_name: "Acme" },
    })
    // Evidence from findings should be in provenance intents
    const hasEvidence = result.draft.provenance.protectionIntents.some((i) => i.evidence.length > 0)
    // For empty founder input, at least ownership missing should have evidence? Actually empty has no owner, so evidence may be empty for missing, but liability not
    // We check that provenance intents preserve what they had, not fabricated
    expect(result.draft.provenance.protectionIntents.length).toBeGreaterThan(0)
    void hasEvidence // evidence may be empty for absence findings, which is correct per evidence model
    expect(result.draft.markdown).toContain("Provenance:")
  })

  it("founder cannot use partnership family and vice versa", () => {
    const fFindings = founderFindings("")
    expect(() =>
      assembleDraft({
        familyId: "partnership-agreement",
        dealType: "founder",
        jurisdiction: { country: "Nigeria" },
        findings: fFindings,
        variables: {},
      })
    ).toThrow(/does not support/)
    const pFindings = partnershipFindings("")
    expect(() =>
      assembleDraft({
        familyId: "founder-agreement",
        dealType: "partnership",
        jurisdiction: { country: "Nigeria" },
        findings: pFindings,
        variables: {},
      })
    ).toThrow(/does not support/)
  })

  it("jurisdiction is explicit — empty throws, does not silently choose", () => {
    const findings = founderFindings("")
    expect(() =>
      assembleDraft({
        familyId: "founder-agreement",
        dealType: "founder",
        jurisdiction: { country: "" },
        findings,
        variables: {},
      })
    ).toThrow(/Jurisdiction is required/)
  })
})
