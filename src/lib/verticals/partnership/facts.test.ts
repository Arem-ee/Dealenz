import { describe, it, expect } from "vitest"
import { derivePartnershipFacts } from "./facts"
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

describe("partnership fact projection", () => {
  it("projects known values with evidence", () => {
    const facts = derivePartnershipFacts(
      extracted(),
      "Alice (managing partner) and Bob (limited partner) split profits 60/40. Each contributes $50,000 in initial capital. Profits are distributed quarterly.",
      { type: "audit_input", id: "audit-1" }
    )
    expect(facts.partnerRoles.text).toMatch(/managing partner/i)
    expect(facts.ownershipSplit.text).toMatch(/profit/i)
    expect(facts.contributions.text).toMatch(/capital|contributes/i)
    expect(facts.profitDistribution.text).toMatch(/distributed/i)
    expect(facts.partnerRoles.evidenceRefs?.length).toBeGreaterThan(0)
  })

  it("leaves missing values unknown instead of fabricating them", () => {
    const facts = derivePartnershipFacts(extracted(), "Just hello.", { type: "audit_input", id: "a1" })
    expect(facts.ownershipSplit.text).toBeNull()
    expect(facts.ownershipSplit.evidence).toBeNull()
    expect(facts.ownershipSplit.evidenceRefs).toEqual([])
    expect(facts.contributions.text).toBeNull()
    expect(facts.governance.text).toBeNull()
  })

  it("treats negated mentions as unobserved", () => {
    const facts = derivePartnershipFacts(extracted(), "No profit split has been agreed.", {
      type: "audit_input",
      id: "a1",
    })
    expect(facts.ownershipSplit.text).toBeNull()
  })

  it("is deterministic across repeated projections", () => {
    const raw = "50/50 profit split. $25,000 each in capital."
    const first = derivePartnershipFacts(extracted(), raw, { type: "audit_input", id: "a1" })
    const second = derivePartnershipFacts(extracted(), raw, { type: "audit_input", id: "a1" })
    expect(second).toEqual(first)
  })
})
