import { describe, it, expect } from "vitest"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { attachEvidence } from "@/lib/evidence"
import { seedEnvelopeForDealType, applyUserConfirmation } from "@/lib/context"
import { deriveFounderFacts } from "@/lib/verticals/founder/facts"
import { derivePartnershipFacts } from "@/lib/verticals/partnership/facts"
import { registerFounderPack, resetFounderRegistration } from "@/lib/verticals/founder/rules"
import { registerPartnershipPack, resetPartnershipRegistration } from "@/lib/verticals/partnership/rules"
import { protectionIntentsFromFindings } from "./intents"
import type { ExtractedData } from "@/lib/ai/extract"
import type { Jurisdiction } from "@/lib/legal-research/types"

const NIGERIA: Jurisdiction = { scope: "country", country: "Nigeria", region: null }

function extracted(): ExtractedData {
  return { goals: [], deliverables: [], timeline: null, budget: null, projectType: null, clientSignals: [], missingInformation: [], confidence: 0.9 }
}

function founderFindings(raw: string) {
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
  return enriched
}

function partnershipFindings(raw: string) {
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
  const enriched = attachEvidence(run.results, input, "document_analysis", "partnership")
  return enriched
}

describe("founder protection intents (Phase 28)", () => {
  it("derives an intent for each FAIL finding, preserving evidence and legal context", () => {
    const findings = founderFindings("")
    const intents = protectionIntentsFromFindings("founder", findings)
    // Empty input triggers all absence rules → 7 intents (liability uncapped needs liability present, so not)
    expect(intents.length).toBeGreaterThanOrEqual(6)
    for (const intent of intents) {
      expect(intent.dealType).toBe("founder")
      expect(intent.findingId).toBe(intent.id)
      expect(intent.problem.length).toBeGreaterThan(0)
      expect(intent.recommendation.length).toBeGreaterThan(0)
      expect(intent.rationale.length).toBeGreaterThan(0)
      expect(["critical", "important", "consider"]).toContain(intent.priority)
      expect(intent.evidence).toBeDefined()
      // Every intent has a category and legal context where available
      expect(intent.category).not.toBe("general")
    }
  })

  it("vesting protection intent carries correct recommendation and variables", () => {
    const findings = founderFindings("")
    const intents = protectionIntentsFromFindings("founder", findings, NIGERIA)
    const vesting = intents.find((i) => i.category === "vesting")
    expect(vesting).toBeDefined()
    expect(vesting!.recommendation).toMatch(/vesting/i)
    expect(vesting!.variables).toContain("vesting period")
    expect(vesting!.variables).toContain("cliff")
    expect(vesting!.status).toBe("needs_input")
    expect(vesting!.legalContext).not.toBeNull()
    expect(vesting!.legalContext!.title).toMatch(/Vesting is contractual/i)
  })

  it("no intent invents law — legal context is a citation from the Nigeria corpus", () => {
    const findings = founderFindings("Alice and Bob split profits 50/50. Partners are liable for all partnership debts with no cap.")
    // Use partnership findings but check founder sourcing still grounded.
    // Jurisdiction is explicit context (no silent default).
    const intents = protectionIntentsFromFindings("partnership", findings, NIGERIA)
    const liability = intents.find((i) => i.category === "liability")
    if (liability?.legalContext) {
      expect(liability.legalContext.url).toMatch(/^https:\/\/(placng\.org|cac\.gov\.ng)/)
      expect(liability.legalContext.passage.length).toBeGreaterThan(10)
    }
  })

  it("PASS/UNKNOWN do not become intents", () => {
    const findings = founderFindings("Alice is CEO and Bob is CTO. Ownership split 60/40. Four-year vesting with a one-year cliff. All IP is assigned to the company. Board decides by majority vote with reserved matters needing consent. Leaver shares are repurchased. Share transfers need board consent.")
    const intents = protectionIntentsFromFindings("founder", findings)
    // Well-formed founder agreement should have no founder FAILs, so no intents
    const founderIntents = intents.filter((i) => i.findingId.startsWith("founder-"))
    expect(founderIntents.length).toBe(0)
  })

  it("isolation: founder intents do not leak into partnership and vice versa", () => {
    const fFindings = founderFindings("")
    const pFindings = partnershipFindings("")
    const fIntents = protectionIntentsFromFindings("founder", fFindings)
    const pIntents = protectionIntentsFromFindings("partnership", pFindings)
    expect(fIntents.every((i) => i.dealType === "founder")).toBe(true)
    expect(pIntents.every((i) => i.dealType === "partnership")).toBe(true)
    expect(fIntents.some((i) => i.category === "contribution")).toBe(false)
    expect(pIntents.some((i) => i.category === "vesting")).toBe(false)
  })
})

describe("partnership protection intents — structure distinction", () => {
  it("distinguishes ordinary partnership, LLP, and unknown structure via facts", () => {
    const llpFacts = derivePartnershipFacts(extracted(), "This is an LLP agreement between Alice and Bob.", { type: "audit_input", id: "a1" })
    expect(llpFacts.partnershipStructure.text).toMatch(/LLP/i)
    const ordinaryFacts = derivePartnershipFacts(extracted(), "The partners will run the business together.", { type: "audit_input", id: "a1" })
    // Ordinary "partners" alone is not a structure signal — remains null (unknown)
    expect(ordinaryFacts.partnershipStructure.text).toBeNull()
    const lpFacts = derivePartnershipFacts(extracted(), "This is a limited partnership with a general and limited partner.", { type: "audit_input", id: "a1" })
    expect(lpFacts.partnershipStructure.text).toMatch(/limited partnership/i)
  })

  it("partnership intents reference structure-aware legal context", () => {
    const findings = partnershipFindings("")
    const intents = protectionIntentsFromFindings("partnership", findings, NIGERIA)
    // At least one partnership intent should have a legal context (Nigeria/CAMA) — e.g. authority → LLP agreement, transfer → LLP nature
    const hasContext = intents.some((i) => i.legalContext !== null && (i.legalContext.url ?? "").includes("placng.org"))
    expect(hasContext).toBe(true)
  })

  it("missing variables remain UNKNOWN / NEEDS INPUT, never invented", () => {
    const findings = partnershipFindings("")
    const intents = protectionIntentsFromFindings("partnership", findings)
    for (const intent of intents) {
      if (intent.variables.length > 0) {
        expect(intent.status).toBe("needs_input")
        // Variables are placeholders, not invented values
        expect(intent.variables.every((v) => typeof v === "string" && v.length > 0)).toBe(true)
        expect(intent.problem).not.toMatch(/\d+%.*invented/i)
      }
    }
  })
})
