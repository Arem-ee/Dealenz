import { describe, it, expect } from "vitest"
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

describe("freelance fact projection", () => {
  it("projects fee and delivery from structured extraction", () => {
    const facts = deriveFreelanceFacts(extracted({ budget: "$5,000 fixed", timeline: "2 weeks" }))
    expect(facts.fee).toEqual({ text: "$5,000 fixed", evidence: "$5,000 fixed" })
    expect(facts.delivery.text).toBe("2 weeks")
    expect(facts.deliverablesCount).toBe(0)
  })

  it("detects unlimited revisions with evidence", () => {
    const facts = deriveFreelanceFacts(
      extracted({ deliverables: ["Website with unlimited revisions until approval"] })
    )
    expect(facts.unlimitedRevisions.value).toBe(true)
    expect(facts.unlimitedRevisions.evidence).toMatch(/unlimited revisions/i)
    expect(facts.revisions.text).toMatch(/revision/i)
  })

  it("detects currency, deposit, termination, ownership, and liability signals", () => {
    const facts = deriveFreelanceFacts(
      extracted({
        budget: "5000 USD, 50% deposit upfront",
        clientSignals: ["Client may terminate with 7 days notice", "Contractor indemnifies client", "Liability for delays is unlimited, capped at fees paid"],
      }),
      "IP assigns to client on payment. NDA attached."
    )
    expect(facts.currency.text).toBe("USD")
    expect(facts.deposit.text).toMatch(/deposit/i)
    expect(facts.termination.text).toMatch(/terminat/i)
    expect(facts.ownership.text).toMatch(/IP|assign/i)
    expect(facts.indemnity.text).toMatch(/indemnif/i)
    // Presence detection reports the first liability-family mention.
    expect(facts.liability.text).not.toBeNull()
    expect(facts.liability.evidence).toMatch(/liab|indemnif/i)
    expect(facts.liabilityCap.text).toMatch(/cap/i)
    expect(facts.confidentiality.text).toMatch(/NDA/i)
  })

  it("leaves unobserved facts unknown instead of inventing them", () => {
    const facts = deriveFreelanceFacts(extracted())
    expect(facts.fee).toEqual({ text: null, evidence: null })
    expect(facts.unlimitedRevisions).toEqual({ value: null, evidence: null })
    expect(facts.ownership.text).toBeNull()
    expect(facts.currency.text).toBeNull()
  })

  it("treats negated mentions as unobserved, not affirmative", () => {
    const facts = deriveFreelanceFacts(
      extracted({ clientSignals: ["No termination clause", "Liability: none", "Without any cap"] })
    )
    expect(facts.termination.text).toBeNull()
    expect(facts.liability.text).toBeNull()
    expect(facts.liabilityCap.text).toBeNull()
  })

  it("does not read unlimited as a liability cap", () => {
    const facts = deriveFreelanceFacts(
      extracted({ clientSignals: ["Liability unlimited"] })
    )
    expect(facts.liability.text).toMatch(/liab/i)
    expect(facts.liabilityCap.text).toBeNull()
  })

  it("is deterministic across repeated projections", () => {
    const input = extracted({ budget: "$100", clientSignals: ["unlimited revisions promised"] })
    expect(deriveFreelanceFacts(input, "extra text")).toEqual(deriveFreelanceFacts(input, "extra text"))
  })
})
