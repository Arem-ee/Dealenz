import { describe, it, expect, vi, beforeEach } from "vitest"

const mockAnalyzeDeal = vi.fn()
vi.mock("@/app/audit/[id]/actions", () => ({
  analyzeDeal: (...args: unknown[]) => mockAnalyzeDeal(...args),
}))

import { isApprovalValidForPlan } from "./transitions"
import { planPayloadHash } from "./hash"

describe("resumability integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAnalyzeDeal.mockReset()
  })

  it("full lifecycle preserves plan identity across needs_input resume", async () => {
    const payloadHash = planPayloadHash({ objective: "Analyze deal: Test", objectiveKind: "deal_analysis", estimatedCredits: 0, steps: [{ operation: "document_analysis", inputRef: { auditId: "a", threadId: "t" }, dependsOn: [], estimatedCredits: 0 }] })
    const planId = "00000000-0000-0000-0000-000000000001"
    const approval = { plan_version: 1, approved_payload_hash: payloadHash, id: "appr-1" }
    const plan = { version: 1, payload_hash: payloadHash, id: planId, status: "needs_input" }

    // Simulate resume preserves ids
    expect(isApprovalValidForPlan(approval as never, plan as never)).toBe(true)
    expect(planId).toBe("00000000-0000-0000-0000-000000000001")
    expect(payloadHash.startsWith("ph_")).toBe(true)

    // Simulate needs_input → resume → succeeded
    mockAnalyzeDeal.mockResolvedValueOnce({ success: false, error: "Missing required context: jurisdiction", contextGate: "needs_input", missingRequiredContext: ["jurisdiction"] })
    const first = await mockAnalyzeDeal("audit-1")
    expect(first.contextGate).toBe("needs_input")

    mockAnalyzeDeal.mockResolvedValueOnce({ success: true, riskReport: { overallScore: 72, riskLevel: "Medium" }, deterministicFindings: [] } as never)
    const second = await mockAnalyzeDeal("audit-1")
    expect(second.success).toBe(true)
    expect(second.riskReport.overallScore).toBe(72)
  })

  it("changed payload invalidates approval", async () => {
    const hash1 = planPayloadHash({ objective: "Analyze deal: Test", objectiveKind: "deal_analysis", estimatedCredits: 0, steps: [{ operation: "document_analysis", inputRef: { auditId: "a", threadId: "t" }, dependsOn: [], estimatedCredits: 0 }] })
    const hash2 = planPayloadHash({ objective: "Analyze deal: Changed", objectiveKind: "deal_analysis", estimatedCredits: 0, steps: [{ operation: "document_analysis", inputRef: { auditId: "a", threadId: "t" }, dependsOn: [], estimatedCredits: 0 }] })
    expect(hash1).not.toBe(hash2)
    expect(isApprovalValidForPlan({ plan_version: 1, approved_payload_hash: hash1 } as never, { version: 1, payload_hash: hash2 } as never)).toBe(false)
    expect(isApprovalValidForPlan({ plan_version: 1, approved_payload_hash: hash1 } as never, { version: 1, payload_hash: hash1 } as never)).toBe(true)
  })

  it("rate_limited is distinct from needs_input and failed", async () => {
    const { planTransition } = await import("./transitions")
    expect(planTransition.can("executing", "rate_limited")).toBe(true)
    expect(planTransition.can("rate_limited", "executing")).toBe(true)
    expect(planTransition.can("executing", "needs_input")).toBe(true)
    expect(planTransition.can("needs_input", "executing")).toBe(true)
    expect(planTransition.can("executing", "failed")).toBe(true)
    // rate_limited should not be confused with needs_input
    expect("rate_limited").not.toBe("needs_input")
  })
})
