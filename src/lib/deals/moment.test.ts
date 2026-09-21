import { describe, it, expect } from "vitest"
import { dealMomentState } from "./moment"

describe("dealMomentState", () => {
  it("prefers executed states over everything", () => {
    expect(dealMomentState({ executed: true, hasMonitoring: true, openIssues: 3 })).toBe("guarded")
    expect(dealMomentState({ executed: true, hasMonitoring: false })).toBe("signed")
    expect(dealMomentState({ executed: true })).toBe("signed")
  })

  it("flags failure and degradation as needs-attention", () => {
    expect(dealMomentState({ status: "failed", openIssues: 2 })).toBe("needs-attention")
    expect(dealMomentState({ rulesDegraded: true, openIssues: 0 })).toBe("needs-attention")
  })

  it("names the signing ceremony when signers are engaged", () => {
    expect(dealMomentState({ signingActive: true, openIssues: 1 })).toBe("ready-to-sign")
  })

  it("distinguishes negotiating (movement) from needs-action (untouched)", () => {
    expect(dealMomentState({ openIssues: 3, resolvedCount: 0 })).toBe("needs-action")
    expect(dealMomentState({ openIssues: 3, resolvedCount: 1 })).toBe("negotiating")
    expect(dealMomentState({ openIssues: 2 })).toBe("needs-action")
  })

  it("stays honest on drafts and unknowns", () => {
    expect(dealMomentState({ status: "draft" })).toBe("draft")
    expect(dealMomentState({ status: "processing", openIssues: null })).toBe("draft")
    expect(dealMomentState({ openIssues: 0, resolvedCount: 0 })).toBe("unknown")
    expect(dealMomentState({})).toBe("unknown")
    expect(dealMomentState({ openIssues: 0, resolvedCount: 2 })).toBe("negotiating")
  })
})
