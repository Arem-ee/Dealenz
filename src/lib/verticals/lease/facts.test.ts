import { describe, it, expect } from "vitest"
import { deriveLeaseFacts } from "./facts"
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

describe("lease fact projection", () => {
  it("projects known values with evidence", () => {
    const facts = deriveLeaseFacts(
      extracted({ budget: "$2,400 per month" }),
      "12-month commercial lease. $500 security deposit. Break clause with 3 months notice. Rent review to market rent. Subletting requires landlord consent."
    )
    expect(facts.rent.text).toBe("$2,400 per month")
    expect(facts.paymentFrequency.text).toMatch(/month/i)
    expect(facts.deposit.text).toMatch(/security deposit/i)
    expect(facts.leaseTerm.text).toMatch(/12-month/i)
    expect(facts.termination.text).toMatch(/break clause/i)
    expect(facts.notice.text).toMatch(/3 months notice/i)
    expect(facts.rentReview.text).toMatch(/rent review|market rent/i)
    expect(facts.subletting.text).toMatch(/sublet/i)
  })

  it("leaves missing values unknown instead of fabricating them", () => {
    const facts = deriveLeaseFacts(extracted())
    expect(facts.rent).toEqual({ text: null, evidence: null })
    expect(facts.leaseTerm.text).toBeNull()
    expect(facts.permittedUse.text).toBeNull()
    expect(facts.insurance.text).toBeNull()
  })

  it("treats negated mentions as unobserved", () => {
    const facts = deriveLeaseFacts(extracted({ clientSignals: ["No renewal option", "Tenant waives no rights"] }))
    expect(facts.renewal.text).toBeNull()
  })

  it("detects maintenance, utilities, and default language", () => {
    const facts = deriveLeaseFacts(
      extracted(),
      "Tenant keeps the premises in good repair. Service charge covers utilities. Arrears over 14 days trigger forfeiture. Vacant possession on expiry."
    )
    expect(facts.maintenance.text).toMatch(/good repair/i)
    expect(facts.repairs.text).toMatch(/repair/i)
    expect(facts.utilities.text).toMatch(/service charge|utilities/i)
    expect(facts.defaultTerms.text).toMatch(/arrears|forfeit/i)
    expect(facts.possession.text).toMatch(/vacant possession/i)
  })

  it("is deterministic across repeated projections", () => {
    const input = extracted({ budget: "$100" })
    expect(deriveLeaseFacts(input, "12 month term")).toEqual(deriveLeaseFacts(input, "12 month term"))
  })
})
