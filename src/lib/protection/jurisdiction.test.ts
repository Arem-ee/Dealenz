import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { attachEvidence } from "@/lib/evidence"
import { seedEnvelopeForDealType, applyUserConfirmation } from "@/lib/context"
import { deriveFounderFacts } from "@/lib/verticals/founder/facts"
import { registerFounderPack, resetFounderRegistration } from "@/lib/verticals/founder/rules"
import { protectionIntentsFromFindings } from "./intents"
import type { ExtractedData } from "@/lib/ai/extract"
import type { Jurisdiction } from "@/lib/legal-research/types"

function extracted(): ExtractedData {
  return { goals: [], deliverables: [], timeline: null, budget: null, projectType: null, clientSignals: [], missingInformation: [], confidence: 0.9 }
}

function founderFindings(raw = ""): ReturnType<typeof evaluateApplicableRules>["results"] {
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

describe("protection intents — jurisdiction-aware", () => {
  it("founder intent uses matching jurisdiction (Nigeria vs US vs UK)", () => {
    const findings = founderFindings("")
    const nigeria: Jurisdiction = { scope: "country", country: "Nigeria", region: null }
    const us: Jurisdiction = { scope: "country", country: "United States", region: null }
    const uk: Jurisdiction = { scope: "territory", country: "United Kingdom", region: "England and Wales" }
    const nIntents = protectionIntentsFromFindings("founder", findings, nigeria)
    const usIntents = protectionIntentsFromFindings("founder", findings, us)
    const ukIntents = protectionIntentsFromFindings("founder", findings, uk)
    // Each should have legal context from its own jurisdiction, not leaked
    expect(nIntents.some((i) => i.legalContext?.jurisdiction === "Nigeria")).toBe(true)
    expect(usIntents.some((i) => i.legalContext?.jurisdiction === "United States")).toBe(true)
    expect(ukIntents.some((i) => i.legalContext?.jurisdiction === "United Kingdom")).toBe(true)
    // No cross-leak
    expect(nIntents.every((i) => !i.legalContext || i.legalContext.jurisdiction === "Nigeria")).toBe(true)
    expect(usIntents.every((i) => !i.legalContext || i.legalContext.jurisdiction === "United States")).toBe(true)
  })

  it("unsupported jurisdiction yields no legal context (honest)", () => {
    const findings = founderFindings("")
    const de: Jurisdiction = { scope: "country", country: "Germany", region: null }
    const intents = protectionIntentsFromFindings("founder", findings, de)
    expect(intents.every((i) => i.legalContext === null)).toBe(true)
  })

  it("UNKNOWN jurisdiction yields no legal context", () => {
    const findings = founderFindings("")
    // Missing jurisdiction never defaults to any country (no Nigeria default):
    // callers without jurisdiction context get honest null legal context.
    const intentsNull = protectionIntentsFromFindings("founder", findings, null)
    expect(intentsNull.every((i) => i.legalContext === null)).toBe(true)
    const intentsUndefined = protectionIntentsFromFindings("founder", findings)
    expect(intentsUndefined.every((i) => i.legalContext === null)).toBe(true)
    const unknown: Jurisdiction = { scope: "custom", country: "UNKNOWN", region: null }
    const intents2 = protectionIntentsFromFindings("founder", findings, unknown)
    expect(intents2.every((i) => i.legalContext === null)).toBe(true)
  })

  it("Nigerian citations do not leak into US deal", () => {
    const findings = founderFindings("")
    const us: Jurisdiction = { scope: "state_province", country: "United States", region: "Delaware" }
    const intents = protectionIntentsFromFindings("founder", findings, us)
    for (const intent of intents) {
      if (intent.legalContext) expect(intent.legalContext.jurisdiction).toBe("United States")
    }
  })
})
