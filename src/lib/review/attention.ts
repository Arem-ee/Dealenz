// Lawyer needs-action model (Phase 7 workspace).
//
// Derived server-side from review status + collaboration state. Neither
// client nor lawyer sets "waiting on me" values: the state machine and the
// comment/proposal facts decide. Pure and fully unit-tested.

export type WaitingOn = "lawyer" | "client" | "none"

export interface AttentionInput {
  status: string
  /** Open lawyer proposals (document comments with status open). */
  openProposalCount?: number
  /** Open client questions (client-authored question comments, status open). */
  openClientQuestions?: number
  /** Pending (unsigned, unrevoked) signer count. */
  pendingSigners?: number
}

export interface Attention {
  needsAction: boolean
  waitingOn: WaitingOn
  reasons: string[]
}

/**
 * Derive who must act next on a review.
 *
 * Status is authoritative; collaboration facts refine within active review:
 * - matched/accepted: lawyer must accept/begin.
 * - in_progress: lawyer owns the review, unless only waiting is theirs done.
 * - changes_requested: client must respond (a proposal awaits them).
 * - client_review: lawyer decides completion.
 * - open client questions always pull the lawyer back in.
 * - terminal/unknown states: nobody (history only).
 */
export function deriveAttention(input: AttentionInput): Attention {
  const reasons: string[] = []
  const proposals = Math.max(0, input.openProposalCount ?? 0)
  const questions = Math.max(0, input.openClientQuestions ?? 0)

  switch (input.status) {
    case "matched":
      return { needsAction: true, waitingOn: "lawyer", reasons: ["Review requested — accept or decline"] }
    case "accepted":
      return { needsAction: true, waitingOn: "lawyer", reasons: ["Review accepted — begin the review"] }
    case "in_progress": {
      if (questions > 0) {
        reasons.push(`Client question${questions === 1 ? "" : "s"} awaiting your answer`)
      }
      if (reasons.length === 0) reasons.push("Review in progress")
      return { needsAction: true, waitingOn: "lawyer", reasons }
    }
    case "changes_requested":
      reasons.push(
        `Proposal${proposals === 1 ? "" : "s"} awaiting the client${proposals > 0 ? "" : " (no open proposal found)"}`
      )
      if (questions > 0) {
        // Awaiting client overall, but their question still needs an answer.
        return { needsAction: true, waitingOn: "client", reasons: [...reasons, `Client question${questions === 1 ? "" : "s"} awaiting your answer`] }
      }
      return { needsAction: false, waitingOn: "client", reasons }
    case "client_review":
      reasons.push("Client responded — decide completion")
      if (questions > 0) reasons.push(`Client question${questions === 1 ? "" : "s"} awaiting your answer`)
      return { needsAction: true, waitingOn: "lawyer", reasons }
    default:
      return { needsAction: false, waitingOn: "none", reasons: [] }
  }
}

/** Bucket label for workload grouping. */
export function attentionBucket(status: string): "needs_action" | "in_review" | "waiting_client" | "completed" {
  const a = deriveAttention({ status })
  if (status === "completed" || status === "cancelled") return "completed"
  if (a.waitingOn === "client") return "waiting_client"
  if (a.needsAction) return "needs_action"
  return "in_review"
}
