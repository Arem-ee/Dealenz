import { describe, it, expect } from "vitest"
import { transitionTarget, isActiveReviewStatus, ACTIVE_REVIEW_STATUSES } from "./transitions"

describe("review lifecycle state machine", () => {
  it("defines the exact happy path", () => {
    expect(transitionTarget("assign", "requested", "admin")).toEqual({ ok: true, to: "matched" })
    expect(transitionTarget("assign", "waitlist", "admin")).toEqual({ ok: true, to: "matched" })
    expect(transitionTarget("accept", "matched", "lawyer")).toEqual({ ok: true, to: "accepted" })
    expect(transitionTarget("begin", "accepted", "lawyer")).toEqual({ ok: true, to: "in_progress" })
    expect(transitionTarget("propose", "in_progress", "lawyer")).toEqual({ ok: true, to: "changes_requested" })
    expect(transitionTarget("propose", "client_review", "lawyer")).toEqual({ ok: true, to: "changes_requested" })
    expect(transitionTarget("respond", "changes_requested", "owner")).toEqual({ ok: true, to: "client_review" })
    expect(transitionTarget("complete", "client_review", "lawyer")).toEqual({ ok: true, to: "completed" })
    expect(transitionTarget("decline", "matched", "lawyer")).toEqual({ ok: true, to: "requested" })
    expect(transitionTarget("cancel", "in_progress", "owner")).toEqual({ ok: true, to: "cancelled" })
  })

  it("rejects invalid from-states", () => {
    expect(transitionTarget("accept", "requested", "lawyer").ok).toBe(false)
    expect(transitionTarget("complete", "matched", "lawyer").ok).toBe(false)
    expect(transitionTarget("propose", "accepted", "lawyer").ok).toBe(false)
    expect(transitionTarget("respond", "in_progress", "owner").ok).toBe(false)
    expect(transitionTarget("cancel", "completed", "owner").ok).toBe(false)
    expect(transitionTarget("cancel", "cancelled", "admin").ok).toBe(false)
  })

  it("rejects wrong actors (no client-controlled status, no lawyer admin)", () => {    expect(transitionTarget("assign", "requested", "lawyer").ok).toBe(false)
    expect(transitionTarget("assign", "requested", "owner").ok).toBe(false)
    expect(transitionTarget("accept", "matched", "owner").ok).toBe(false)
    expect(transitionTarget("accept", "matched", "admin").ok).toBe(false)
    expect(transitionTarget("complete", "in_progress", "owner").ok).toBe(false)
    expect(transitionTarget("respond", "changes_requested", "lawyer").ok).toBe(false)
    expect(transitionTarget("cancel", "matched", "lawyer").ok).toBe(false)
  })

  it("allows the deterministic system matcher the same assign states as admin", () => {
    expect(transitionTarget("assign", "requested", "system")).toEqual({ ok: true, to: "matched" })
    expect(transitionTarget("assign", "waitlist", "system")).toEqual({ ok: true, to: "matched" })
    // System matching is assign-only: it can never accept, complete, or cancel.
    expect(transitionTarget("accept", "matched", "system").ok).toBe(false)
    expect(transitionTarget("complete", "client_review", "system").ok).toBe(false)
    expect(transitionTarget("cancel", "requested", "system").ok).toBe(false)
    expect(transitionTarget("assign", "matched", "system").ok).toBe(false)
  })

  it("rejects unknown transitions", () => {
    expect(transitionTarget("escalate" as never, "matched", "lawyer").ok).toBe(false)
  })

  it("marks exactly the active states (terminal states revoke access)", () => {
    expect([...ACTIVE_REVIEW_STATUSES].sort()).toEqual(
      ["accepted", "changes_requested", "client_review", "in_progress", "matched"].sort()
    )
    for (const s of ["requested", "waitlist", "completed", "cancelled"]) {
      expect(isActiveReviewStatus(s)).toBe(false)
    }
  })
})
