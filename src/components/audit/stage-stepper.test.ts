import { describe, it, expect } from "vitest"
import { stagesForDealType, getStageState, STAGES } from "./stage-stepper"

describe("stagesForDealType", () => {
  it("keeps the full freelance pipeline untouched", () => {
    expect(stagesForDealType("freelance")).toEqual(STAGES)
    expect(stagesForDealType("freelance").map((s) => s.id)).toEqual([
      "intake",
      "risk-analysis",
      "proposal",
      "sow",
      "contract",
      "checklist",
      "active",
      "closed",
    ])
  })

  it("gives document-capable deal types a neutral three-stage model", () => {
    for (const dealType of ["founder", "partnership", "purchase_sale", "lease", "employment"]) {
      expect(stagesForDealType(dealType).map((s) => s.id)).toEqual(["intake", "risk-analysis", "documents"])
    }
  })

  it("gives generic a neutral two-stage model with no invented stages", () => {
    expect(stagesForDealType("generic").map((s) => s.id)).toEqual(["intake", "risk-analysis"])
    expect(stagesForDealType("unknown-type").map((s) => s.id)).toEqual(["intake", "risk-analysis"])
  })

  it("never shows freelance pipeline stages to non-freelance deals", () => {
    for (const dealType of ["founder", "partnership", "purchase_sale", "lease", "employment", "generic"]) {
      const ids = stagesForDealType(dealType).map((s) => s.id)
      for (const freelanceOnly of ["proposal", "sow", "contract", "checklist", "active", "closed"]) {
        expect(ids).not.toContain(freelanceOnly)
      }
    }
  })
})

describe("getStageState with documents stage", () => {
  const documents = { id: "documents", label: "Documents", description: "Drafts and finals" } as const

  it("completes documents only when documents exist", () => {
    expect(getStageState(documents, "documents", true, true, false)).toBe("current")
    expect(getStageState(documents, "intake", true, true, true)).toBe("completed")
    expect(getStageState(documents, "intake", true, false, false)).toBe("locked")
  })

  it("preserves freelance behavior exactly", () => {
    const proposal = STAGES.find((s) => s.id === "proposal")!
    expect(getStageState(proposal, "proposal", true, true, false)).toBe("current")
    expect(getStageState(proposal, "risk-analysis", true, true, true)).toBe("completed")
  })
})
