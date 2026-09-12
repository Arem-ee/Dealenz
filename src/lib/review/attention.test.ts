import { describe, it, expect } from "vitest"
import { deriveAttention, attentionBucket } from "./attention"

describe("deriveAttention", () => {
  it("routes each active status to the right owner", () => {
    expect(deriveAttention({ status: "matched" })).toEqual({
      needsAction: true,
      waitingOn: "lawyer",
      reasons: ["Review requested — accept or decline"],
    })
    expect(deriveAttention({ status: "accepted" }).waitingOn).toBe("lawyer")
    expect(deriveAttention({ status: "in_progress" })).toMatchObject({ needsAction: true, waitingOn: "lawyer" })
    expect(deriveAttention({ status: "changes_requested" })).toMatchObject({ needsAction: false, waitingOn: "client" })
    expect(deriveAttention({ status: "client_review" })).toMatchObject({ needsAction: true, waitingOn: "lawyer" })
  })

  it("pulls the lawyer back in for unanswered client questions", () => {
    const inProgress = deriveAttention({ status: "in_progress", openClientQuestions: 2 })
    expect(inProgress.reasons.join(" ")).toMatch(/awaiting your answer/)
    const waiting = deriveAttention({ status: "changes_requested", openClientQuestions: 1 })
    expect(waiting.needsAction).toBe(true)
    expect(waiting.waitingOn).toBe("client")
  })

  it("terminal and unknown states need nobody", () => {
    for (const status of ["completed", "cancelled", "requested", "waitlist", "bogus"]) {
      expect(deriveAttention({ status })).toEqual({ needsAction: false, waitingOn: "none", reasons: [] })
    }
  })

  it("clamps negative counts and stays deterministic", () => {
    const a = deriveAttention({ status: "in_progress", openProposalCount: -5, openClientQuestions: -2 })
    expect(a).toEqual(deriveAttention({ status: "in_progress" }))
  })
})

describe("attentionBucket", () => {
  it("buckets workload honestly", () => {
    expect(attentionBucket("matched")).toBe("needs_action")
    expect(attentionBucket("in_progress")).toBe("needs_action")
    expect(attentionBucket("changes_requested")).toBe("waiting_client")
    expect(attentionBucket("completed")).toBe("completed")
    expect(attentionBucket("cancelled")).toBe("completed")
  })
})
