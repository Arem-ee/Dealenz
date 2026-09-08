import { describe, it, expect } from "vitest"
import { deriveFounderFacts } from "./facts"
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

describe("founder fact projection", () => {
  it("projects known values with evidence", () => {
    const facts = deriveFounderFacts(
      extracted(),
      "Alice (CEO) and Bob (CTO) split ownership 60/40. Four-year vesting with a one-year cliff. All IP is assigned to the company.",
      { type: "audit_input", id: "audit-1" }
    )
    expect(facts.founderRoles.text).toMatch(/CEO/i)
    expect(facts.ownershipSplit.text).toMatch(/ownership/i)
    expect(facts.vesting.text).toMatch(/vesting/i)
    expect(facts.ipAssignment.text).toMatch(/IP|assigned/i)
    expect(facts.founderRoles.evidenceRefs?.length).toBeGreaterThan(0)
  })

  it("leaves missing values unknown instead of fabricating them", () => {
    const facts = deriveFounderFacts(extracted(), "Just hello.", { type: "audit_input", id: "a1" })
    expect(facts.ownershipSplit.text).toBeNull()
    expect(facts.ownershipSplit.evidence).toBeNull()
    expect(facts.ownershipSplit.evidenceRefs).toEqual([])
    expect(facts.vesting.text).toBeNull()
    expect(facts.governance.text).toBeNull()
  })

  it("treats negated mentions as unobserved", () => {
    const facts = deriveFounderFacts(extracted(), "No vesting schedule has been agreed.", {
      type: "audit_input",
      id: "a1",
    })
    expect(facts.vesting.text).toBeNull()
  })

  it("is deterministic across repeated projections", () => {
    const raw = "50/50 ownership. Vesting over 4 years."
    const first = deriveFounderFacts(extracted(), raw, { type: "audit_input", id: "a1" })
    const second = deriveFounderFacts(extracted(), raw, { type: "audit_input", id: "a1" })
    expect(second).toEqual(first)
  })
})
