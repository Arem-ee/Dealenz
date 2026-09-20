import { describe, it, expect } from "vitest"
import { describeWorkspace } from "./workspace"

describe("describeWorkspace", () => {
  it("puts approval-gated plans first", () => {
    expect(
      describeWorkspace({ planStatus: "awaiting_approval", latestRichType: "risk_report" }).mode
    ).toBe("approval")
    expect(
      describeWorkspace({ planStatus: "needs_input", latestRichType: "document_draft" }).mode
    ).toBe("approval")
  })

  it("puts running execution above stale cards", () => {
    expect(
      describeWorkspace({ planStatus: "executing", latestRichType: "risk_report" }).mode
    ).toBe("executing")
    expect(
      describeWorkspace({ executionStatus: "running", latestRichType: "risk_report" }).mode
    ).toBe("executing")
  })

  it("names protection plans from their objective kind; retired batch plans fall through", () => {
    expect(describeWorkspace({ planObjectiveKind: "protection" }).mode).toBe("protection")
    // proposal_batch no longer captures the workspace (bulk outreach
    // removed): grandfathered plans fall back to card/operation modes.
    expect(describeWorkspace({ planObjectiveKind: "proposal_batch" }).mode).toBe("idle")
  })

  it("derives proposal, negotiation, and draft from the classified objective", () => {
    expect(describeWorkspace({ operation: "proposal" }).mode).toBe("proposal")
    expect(describeWorkspace({ operation: "negotiation" }).mode).toBe("negotiation")
    expect(describeWorkspace({ operation: "drafting" }).mode).toBe("draft")
  })

  it("prefers signing engagement over older cards", () => {
    expect(
      describeWorkspace({ signerCount: 1, latestRichType: "risk_report" }).mode
    ).toBe("signing")
    expect(
      describeWorkspace({ activeSigning: true, latestRichType: "risk_report" }).mode
    ).toBe("signing")
  })

  it("names the workspace from the latest structured output", () => {
    expect(describeWorkspace({ latestRichType: "risk_report" }).mode).toBe("review")
    expect(describeWorkspace({ latestRichType: "document_draft" }).mode).toBe("draft")
    expect(describeWorkspace({ latestRichType: "document_draft_turn" }).mode).toBe("draft")
    expect(describeWorkspace({ latestRichType: "context_confirm" }).mode).toBe("confirm")
    expect(describeWorkspace({ latestRichType: "lawyer_recommendation" }).mode).toBe("lawyer")
  })

  it("falls back to monitoring, documents, then idle", () => {
    expect(describeWorkspace({ monitoringCount: 2 }).mode).toBe("monitoring")
    expect(describeWorkspace({ documentCount: 1 }).mode).toBe("draft")
    expect(describeWorkspace({}).mode).toBe("idle")
  })

  it("never invents certainty: titles describe state, not verdicts", () => {
    const described = describeWorkspace({ latestRichType: "risk_report" })
    expect(described.title).not.toMatch(/safe|risk-free|approved/i)
  })
})
