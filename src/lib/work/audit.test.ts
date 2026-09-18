import { describe, it, expect } from "vitest"
import { planPayloadHash } from "./hash"

describe("audit trail reconstruction", () => {
  it("plan payload hash binds objective+steps+credits", () => {
    const p1 = { objective: "Prepare proposals for 3 clients", objectiveKind: "proposal_batch", estimatedCredits: 6, steps: [{ operation: "validate_rows", inputRef: { rows: 3 }, dependsOn: [], estimatedCredits: 1 }, { operation: "generate_draft", inputRef: {}, dependsOn: [], estimatedCredits: 5 }] }
    const p2 = { ...p1, estimatedCredits: 7 }
    expect(planPayloadHash(p1 as never)).not.toBe(planPayloadHash(p2 as never))
  })
  it("stale approval does not authorize new plan version", async () => {
    const { isApprovalValidForPlan } = await import("./transitions")
    const approval = { plan_version: 1, approved_payload_hash: "ph_old" }
    const planV2 = { version: 2, payload_hash: "ph_new" }
    expect(isApprovalValidForPlan(approval as never, planV2 as never)).toBe(false)
  })
  it("work product snapshot preserves hash", () => {
    const hash = planPayloadHash({ objective: "Analyze deal", objectiveKind: "deal_analysis", estimatedCredits: 3, steps: [{ operation: "document_analysis", inputRef: {}, dependsOn: [], estimatedCredits: 3 }] })
    expect(hash.startsWith("ph_")).toBe(true)
  })
})
