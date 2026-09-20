import { describe, it, expect } from "vitest"
import { assembleCounterpartyMemory } from "./memory"

describe("assembleCounterpartyMemory", () => {
  it("returns no identity when the deal is not linked to a client", () => {
    expect(assembleCounterpartyMemory("a1", null, [{ id: "a2" }])).toEqual({
      hasIdentity: false,
      clientName: null,
      pastDeals: [],
    })
  })

  it("summarizes flagged and resolved items from prior linked deals", () => {
    const mem = assembleCounterpartyMemory("a1", "Brightline", [
      {
        id: "a1",
        title: "Current",
        structured_data: { deterministicFindings: [] },
      },
      {
        id: "a0",
        title: "Website redesign",
        deal_type: "freelance",
        status: "analyzed",
        created_at: "2026-01-01",
        structured_data: {
          deterministicFindings: [
            { status: "FAIL", ruleKey: "freelance-unlimited-revisions", finding: { severity: "material", summary: "Unlimited revisions promised." } },
            { status: "PASS", ruleKey: "other" },
            null,
          ],
          findingDelta: {
            resolved: [{ ruleKey: "freelance-unlimited-revisions", summary: "Unlimited revisions promised." }],
          },
        },
      },
    ])
    expect(mem.hasIdentity).toBe(true)
    expect(mem.clientName).toBe("Brightline")
    expect(mem.pastDeals).toHaveLength(1)
    expect(mem.pastDeals[0].flagged).toEqual([
      { ruleKey: "freelance-unlimited-revisions", summary: "Unlimited revisions promised.", severity: "material" },
    ])
    expect(mem.pastDeals[0].resolved).toEqual([
      { ruleKey: "freelance-unlimited-revisions", summary: "Unlimited revisions promised." },
    ])
  })

  it("caps history at five deals and ten items each", () => {
    const priors = Array.from({ length: 8 }, (_, i) => ({ id: `a${i + 2}`, title: `d${i}` }))
    const mem = assembleCounterpartyMemory("a1", "Brightline", priors)
    expect(mem.pastDeals).toHaveLength(5)
  })
})
