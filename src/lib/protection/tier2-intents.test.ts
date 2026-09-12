import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { attachEvidence } from "@/lib/evidence"
import { seedEnvelopeForDealType } from "@/lib/context"
import { derivePurchaseSaleFacts } from "@/lib/verticals/purchase_sale/facts"
import { registerPurchaseSalePack, resetPurchaseSaleRegistration } from "@/lib/verticals/purchase_sale/rules"
import { deriveLeaseFacts } from "@/lib/verticals/lease/facts"
import { registerLeasePack, resetLeaseRegistration } from "@/lib/verticals/lease/rules"
import { deriveEmploymentFacts } from "@/lib/verticals/employment/facts"
import { registerEmploymentPack, resetEmploymentRegistration } from "@/lib/verticals/employment/rules"
import { protectionIntentsFromFindings } from "./intents"
import type { ExtractedData } from "@/lib/ai/extract"
import type { Jurisdiction } from "@/lib/legal-research/types"

function extracted(): ExtractedData {
  return { goals: [], deliverables: [], timeline: null, budget: null, projectType: null, clientSignals: [], missingInformation: [], confidence: 0.9 }
}

function tier2Findings(
  dealType: "purchase_sale" | "lease" | "employment",
  register: () => void,
  derive: (data: ExtractedData, raw: string, source: { type: "audit_input"; id: string }) => unknown,
  factKey: string,
  raw = ""
) {
  register()
  const envelope = seedEnvelopeForDealType(dealType)
  const facts = derive(extracted(), raw, { type: "audit_input", id: "audit-1" })
  const input = {
    context: envelope,
    facts: { [factKey]: JSON.parse(JSON.stringify(facts)) as unknown },
    knowledge: [],
    operation: "document_analysis" as const,
    evaluatedAt: "2026-09-04T00:00:00.000Z",
  }
  const run = evaluateApplicableRules(input, "document_analysis", dealType)
  return attachEvidence(run.results, input, "document_analysis", dealType)
}

beforeEach(() => {
  clearRegistry()
  resetPurchaseSaleRegistration()
  resetLeaseRegistration()
  resetEmploymentRegistration()
})

describe("Tier 2 protection intents (purchase_sale / lease / employment)", () => {
  it("maps purchase_sale FAILs to Tier 2 categories with variables", () => {
    // Liability language present without a cap so purchase-liability-uncapped fires.
    const findings = tier2Findings("purchase_sale", registerPurchaseSalePack, derivePurchaseSaleFacts, "purchase_sale", "The seller shall be liable for all damages and indemnify the buyer.")
    const intents = protectionIntentsFromFindings("purchase_sale", findings, null)
    const byId = new Map(intents.map((i) => [i.id, i]))
    expect(byId.get("purchase-price-missing")?.category).toBe("payment")
    expect(byId.get("purchase-asset-missing")?.category).toBe("subject")
    expect(byId.get("purchase-completion-missing")?.category).toBe("delivery")
    expect(byId.get("purchase-title-transfer-missing")?.category).toBe("transfer")
    expect(byId.get("purchase-inspection-missing")?.category).toBe("warranty")
    expect(byId.get("purchase-termination-missing")?.category).toBe("termination")
    expect(byId.get("purchase-liability-uncapped")?.category).toBe("liability")
    for (const intent of intents) {
      expect(intent.dealType).toBe("purchase_sale")
      expect(intent.variables.length).toBeGreaterThan(0)
      expect(intent.status).toBe("needs_input")
    }
  })

  it("maps lease FAILs to Tier 2 categories with variables", () => {
    const findings = tier2Findings("lease", registerLeasePack, deriveLeaseFacts, "lease", "The tenant shall be liable for all damages and indemnify the landlord. Subletting and assignment require the landlord's written consent.")
    const intents = protectionIntentsFromFindings("lease", findings, null)
    const byId = new Map(intents.map((i) => [i.id, i]))
    expect(byId.get("lease-rent-terms-missing")?.category).toBe("payment")
    expect(byId.get("lease-term-missing")?.category).toBe("term")
    expect(byId.get("lease-termination-notice-missing")?.category).toBe("termination")
    expect(byId.get("lease-deposit-missing")?.category).toBe("payment")
    expect(byId.get("lease-maintenance-unclear")?.category).toBe("maintenance")
    expect(byId.get("lease-liability-uncapped")?.category).toBe("liability")
    expect(byId.get("lease-permitted-use-unclear")?.category).toBe("subject")
    expect(byId.get("lease-subletting-terms-present")?.category).toBe("transfer")
    for (const intent of intents) {
      expect(intent.dealType).toBe("lease")
      expect(intent.variables.length).toBeGreaterThan(0)
      expect(intent.status).toBe("needs_input")
    }
  })

  it("maps employment FAILs to Tier 2 categories with variables", () => {
    const findings = tier2Findings("employment", registerEmploymentPack, deriveEmploymentFacts, "employment", "The employee shall be liable for all damages and indemnify the employer.")
    const intents = protectionIntentsFromFindings("employment", findings, null)
    const byId = new Map(intents.map((i) => [i.id, i]))
    expect(byId.get("employment-compensation-missing")?.category).toBe("compensation")
    expect(byId.get("employment-role-missing")?.category).toBe("roles")
    expect(byId.get("employment-termination-missing")?.category).toBe("termination")
    expect(byId.get("employment-liability-uncapped")?.category).toBe("liability")
    for (const intent of intents) {
      expect(intent.dealType).toBe("employment")
      expect(intent.variables.length).toBeGreaterThan(0)
      expect(intent.status).toBe("needs_input")
    }
  })

  it("missing jurisdiction yields no legal context for Tier 2 (never a Nigeria default)", () => {
    const dealTypes = [
      tier2Findings("purchase_sale", registerPurchaseSalePack, derivePurchaseSaleFacts, "purchase_sale"),
      tier2Findings("lease", registerLeasePack, deriveLeaseFacts, "lease"),
      tier2Findings("employment", registerEmploymentPack, deriveEmploymentFacts, "employment"),
    ] as const
    const keys = ["purchase_sale", "lease", "employment"] as const
    dealTypes.forEach((findings, idx) => {
      const intents = protectionIntentsFromFindings(keys[idx], findings, null)
      expect(intents.length).toBeGreaterThan(0)
      expect(intents.every((i) => i.legalContext === null)).toBe(true)
    })
  })

  it("US jurisdiction never receives Nigerian legal context for Tier 2", () => {
    const us: Jurisdiction = { scope: "country", country: "United States", region: null }
    const findings = tier2Findings("purchase_sale", registerPurchaseSalePack, derivePurchaseSaleFacts, "purchase_sale")
    const intents = protectionIntentsFromFindings("purchase_sale", findings, us)
    for (const intent of intents) {
      if (intent.legalContext) expect(intent.legalContext.jurisdiction).toBe("United States")
    }
    // Mapped categories are US-grounded (UCC sale of goods), not null
    const payment = intents.find((i) => i.id === "purchase-price-missing")!
    expect(payment.legalContext).not.toBeNull()
    expect(payment.legalContext!.jurisdiction).toBe("United States")
  })

  it("UK jurisdiction grounds Tier 2 purchase_sale in UK law", () => {
    const uk: Jurisdiction = { scope: "territory", country: "United Kingdom", region: "England and Wales" }
    const findings = tier2Findings("purchase_sale", registerPurchaseSalePack, derivePurchaseSaleFacts, "purchase_sale")
    const intents = protectionIntentsFromFindings("purchase_sale", findings, uk)
    const warranty = intents.find((i) => i.id === "purchase-inspection-missing")!
    expect(warranty.legalContext).not.toBeNull()
    expect(warranty.legalContext!.jurisdiction).toBe("United Kingdom")
  })

  it("region gate: California tenancy law grounds California leases, never New York ones", () => {
    const raw = "The tenant shall be liable for all damages and indemnify the landlord."
    const findings = tier2Findings("lease", registerLeasePack, deriveLeaseFacts, "lease", raw)
    const ca: Jurisdiction = { scope: "state_province", country: "United States", region: "California" }
    const caIntents = protectionIntentsFromFindings("lease", findings, ca)
    const caTerm = caIntents.find((i) => i.id === "lease-term-missing")!
    expect(caTerm.legalContext).not.toBeNull()
    expect(caTerm.legalContext!.jurisdiction).toBe("United States")
    const ny: Jurisdiction = { scope: "state_province", country: "United States", region: "New York" }
    const nyIntents = protectionIntentsFromFindings("lease", findings, ny)
    expect(nyIntents.every((i) => i.legalContext === null)).toBe(true)
  })
})
