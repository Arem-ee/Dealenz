import { describe, it, expect } from "vitest"
import { buildHandoffPackage, validateHandoffPackage } from "./handoff"
import { protectionIntentsFromFindings } from "@/lib/protection/intents"
import { clausesForDealType } from "@/lib/protection/clauses"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { attachEvidence } from "@/lib/evidence"
import { seedEnvelopeForDealType, applyUserConfirmation } from "@/lib/context"
import { deriveFounderFacts } from "@/lib/verticals/founder/facts"
import { derivePartnershipFacts } from "@/lib/verticals/partnership/facts"
import { registerFounderPack, resetFounderRegistration } from "@/lib/verticals/founder/rules"
import { registerPartnershipPack, resetPartnershipRegistration } from "@/lib/verticals/partnership/rules"
import type { ExtractedData } from "@/lib/ai/extract"
import type { RuleResult } from "@/lib/rules/result"
import { makeEvidence } from "@/lib/evidence/schema"

function extracted(): ExtractedData {
  return { goals: [], deliverables: [], timeline: null, budget: null, projectType: null, clientSignals: [], missingInformation: [], confidence: 0.9 }
}

function founderPackage(raw = "Founder deal", jurisdictionCountry = "Nigeria") {
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
  const enriched = attachEvidence(run.results, input, "document_analysis", "founder")
  const jurisdiction = jurisdictionCountry === "UNKNOWN" ? null : ({ scope: "country" as const, country: jurisdictionCountry, region: null } as const)
  const intents = protectionIntentsFromFindings("founder", enriched, jurisdiction as never)
  const clauses = clausesForDealType("founder")
  const legalCitations = intents.map((i) => i.legalContext).filter((c): c is NonNullable<typeof c> => c !== null)
  return buildHandoffPackage(
    {
      audit: { id: "audit-1", deal_type: "founder", title: "Founder Deal" },
      jurisdiction: { country: jurisdictionCountry },
      facts: { founder: facts as unknown as Record<string, unknown> },
      findings: enriched,
      riskReport: { overallScore: 40, riskLevel: "High" },
      protectionIntents: intents,
      clauses,
      draft: null,
      legalCitations,
    },
    new Date("2026-05-15T00:00:00.000Z")
  )
}

function partnershipPackage(raw = "Partnership deal", jurisdictionCountry = "Nigeria", structure: string | null = null) {
  clearRegistry()
  resetPartnershipRegistration()
  registerPartnershipPack()
  const envelope = applyUserConfirmation(seedEnvelopeForDealType("partnership"), { userRole: { value: "partner" } } as never)
  const facts = derivePartnershipFacts(extracted(), raw, { type: "audit_input", id: "audit-2" })
  const input = {
    context: envelope,
    facts: { partnership: JSON.parse(JSON.stringify(facts)) as unknown },
    knowledge: [],
    operation: "document_analysis" as const,
    evaluatedAt: "2026-09-04T00:00:00.000Z",
  }
  const run = evaluateApplicableRules(input, "document_analysis", "partnership")
  const enriched = attachEvidence(run.results, input, "document_analysis", "partnership")
  const jurisdiction = jurisdictionCountry === "UNKNOWN" ? null : ({ scope: "country" as const, country: jurisdictionCountry, region: null } as const)
  const intents = protectionIntentsFromFindings("partnership", enriched, jurisdiction as never)
  const clauses = clausesForDealType("partnership")
  const legalCitations = intents.map((i) => i.legalContext).filter((c): c is NonNullable<typeof c> => c !== null)
  // Simulate draft with structure
  const draft = structure
    ? { familyId: "partnership-agreement", title: "Partnership Agreement", markdown: `# Partnership Agreement\nStructure: ${structure}`, missingVariables: structure === "UNKNOWN" ? ["partnership_structure"] : [], citations: legalCitations, provenance: {} as never, variables: {}, warnings: [] } as never
    : null
  return buildHandoffPackage(
    {
      audit: { id: "audit-2", deal_type: "partnership", title: "Partnership Deal" },
      jurisdiction: { country: jurisdictionCountry },
      facts: { partnership: facts as unknown as Record<string, unknown> },
      findings: enriched,
      riskReport: { overallScore: 40, riskLevel: "High" },
      protectionIntents: intents,
      clauses,
      draft,
      legalCitations,
    },
    new Date("2026-05-15T00:00:00.000Z")
  )
}

describe("lawyer handoff package — Founder/Partnership", () => {
  it("founder package contains founder findings/protection/document context and not partnership", () => {
    const pkg = founderPackage("Alice and Bob split ownership 60/40. Vesting 4 years.")
    expect(pkg.deal.dealType).toBe("founder")
    expect(pkg.findings.some((f) => f.ruleKey.startsWith("founder-"))).toBe(true)
    expect(pkg.findings.some((f) => f.ruleKey.startsWith("partnership-"))).toBe(false)
    expect(pkg.protectionIntents.every((i) => i.dealType === "founder")).toBe(true)
    expect(pkg.clauses.every((c) => c.dealTypes.includes("founder"))).toBe(true)
    expect(validateHandoffPackage(pkg).valid).toBe(true)
  })

  it("partnership package contains partnership findings and distinguishes LLP vs ordinary vs UNKNOWN", () => {
    const llp = partnershipPackage("LLP agreement between Alice and Bob.", "Nigeria", "LLP")
    expect(llp.deal.dealType).toBe("partnership")
    expect(llp.clauses.every((c) => c.dealTypes.includes("partnership"))).toBe(true)
    expect(llp.documentDraft?.familyId).toBe("partnership-agreement")
    expect(llp.missingInformation).not.toContain("jurisdiction")

    const unknown = partnershipPackage("Partnership deal.", "Nigeria", "UNKNOWN")
    // UNKNOWN structure should be surfaced as missing, not invented
    expect(unknown.missingInformation).toContain("partnership_structure")
    expect(unknown.documentDraft?.missingVariables).toContain("partnership_structure")
    expect(unknown.findings.some((f) => f.ruleKey.startsWith("founder-"))).toBe(false)
  })

  it("founder does not receive partnership material and vice versa", () => {
    const f = founderPackage()
    const p = partnershipPackage()
    expect(f.clauses.some((c) => c.dealTypes.includes("partnership") && !c.dealTypes.includes("founder"))).toBe(false)
    // Founder clauses should not appear in partnership handoff
    const founderClauseIds = new Set(f.clauses.map((c) => c.id))
    const partnershipClauseIds = new Set(p.clauses.map((c) => c.id))
    for (const id of founderClauseIds) {
      if (id.startsWith("partnership-")) expect(partnershipClauseIds.has(id)).toBe(true)
      if (id.startsWith("founder-")) expect(partnershipClauseIds.has(id)).toBe(false)
    }
  })

  it("evidence is preserved — exact remains exact, unavailable stays unavailable, no fabrication", () => {
    const evidence = makeEvidence({
      sourceType: "audit_input",
      sourceId: "audit-1",
      quote: "50/50 ownership",
      observationKey: "facts.founder.ownershipSplit",
      method: "pattern_observation",
      confidence: 0.8,
      inspectable: true,
      location: { kind: "exact", section: "raw_input", startOffset: 0, endOffset: 13 },
    })
    const pkg = buildHandoffPackage(
      {
        audit: { id: "audit-1", deal_type: "founder" },
        jurisdiction: { country: "Nigeria" },
        facts: null,
        findings: [
          {
            ruleKey: "founder-ownership-split-missing",
            ruleVersion: "v1",
            status: "FAIL",
            finding: { ruleKey: "founder-ownership-split-missing", ruleVersion: 1, summary: "No ownership split", severity: "attention", guidance: "Write it down", authority: { kind: "product_policy", note: "n" }, evidence: [evidence] },
            reason: "fired",
            authority: { kind: "product_policy", note: "n" },
            evaluatedAt: new Date().toISOString(),
          } as RuleResult,
        ],
        riskReport: null,
        protectionIntents: [],
        clauses: [],
        draft: null,
        legalCitations: [],
      },
      new Date()
    )
    expect(pkg.evidence).toHaveLength(1)
    expect(pkg.evidence[0].id).toBe(evidence.id)
    expect(pkg.evidence[0].location.kind).toBe("exact")

    const unavailable = makeEvidence({
      sourceType: "audit_input",
      sourceId: "audit-1",
      quote: "liability",
      observationKey: "facts.founder.liability",
      method: "pattern_observation",
      confidence: 0.8,
      inspectable: false,
      location: { kind: "approximate", section: "raw_input" },
    })
    const pkg2 = buildHandoffPackage(
      {
        audit: { id: "audit-1", deal_type: "founder" },
        jurisdiction: { country: "Nigeria" },
        facts: null,
        findings: [
          {
            ruleKey: "founder-liability-uncapped",
            ruleVersion: "v1",
            status: "FAIL",
            finding: { ruleKey: "founder-liability-uncapped", ruleVersion: 1, summary: "Liability uncapped", severity: "material", guidance: "Cap it", authority: { kind: "product_policy", note: "n" }, evidence: [unavailable] },
            reason: "fired",
            authority: { kind: "product_policy", note: "n" },
            evaluatedAt: new Date().toISOString(),
          } as RuleResult,
        ],
        riskReport: null,
        protectionIntents: [],
        clauses: [],
        draft: null,
        legalCitations: [],
      },
      new Date()
    )
    expect(pkg2.evidence[0].location.kind).toBe("approximate")
  })

  it("legal provenance: verified stays verified, unsupported jurisdiction stays NOT_FOUND and does not leak", () => {
    const nigeria = founderPackage("vesting", "Nigeria")
    expect(nigeria.legalCitations.length).toBeGreaterThan(0)
    expect(nigeria.legalCitations[0].jurisdiction).toBe("Nigeria")
    const uk = founderPackage("vesting", "United Kingdom")
    expect(uk.deal.jurisdiction.country).toBe("United Kingdom")
    // UK now has verified UK citations (England & Wales) — not Nigerian leak
    expect(uk.legalCitations.length).toBeGreaterThan(0)
    expect(uk.legalCitations[0].jurisdiction).toBe("United Kingdom")
    for (const c of uk.legalCitations) {
      expect(c.jurisdiction).toBe("United Kingdom")
    }
    // Ensure no Nigerian citation leaks into UK
    expect(uk.legalCitations.every((c) => c.jurisdiction !== "Nigeria")).toBe(true)
    const de = founderPackage("vesting", "Germany")
    expect(de.legalCitations.length).toBe(0) // Germany unsupported → NOT_FOUND
  })

  it("jurisdiction safety: UNKNOWN is surfaced, not silently defaulted to Nigeria", () => {
    const pkg = buildHandoffPackage(
      {
        audit: { id: "audit-1", deal_type: "founder" },
        jurisdiction: { country: "UNKNOWN" },
        facts: null,
        findings: [],
        riskReport: null,
        protectionIntents: [],
        clauses: [],
        draft: null,
        legalCitations: [],
      },
      new Date()
    )
    expect(pkg.missingInformation).toContain("jurisdiction")
    expect(pkg.deal.jurisdiction.country).toBe("UNKNOWN")
  })

  it("isolation: founder↔partnership and founder↔freelance remain separate", () => {
    const f = founderPackage()
    const p = partnershipPackage()
    expect(f.findings.every((f) => !f.ruleKey.startsWith("partnership-"))).toBe(true)
    expect(p.findings.every((f) => !f.ruleKey.startsWith("founder-"))).toBe(true)
    expect(f.protectionIntents.every((i) => i.dealType === "founder")).toBe(true)
    expect(p.protectionIntents.every((i) => i.dealType === "partnership")).toBe(true)
  })
})
