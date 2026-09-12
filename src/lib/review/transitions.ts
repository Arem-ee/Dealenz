// Review lifecycle state machine (Phase 5 lawyer review).
//
// Single choke point for every consultation status change: server actions
// must pass through canTransition(); the database never trusts
// client-supplied status. Terminal states revoke lawyer write access
// (enforced by callers + RLS status predicates, never by the client).
//
// Lifecycle:
//   requested|waitlist --assign--> matched --decline--> requested
// ("assign" has two actors: "admin" for manual exception handling, "system"
// for the deterministic auto-assignment RPC. Both land on "matched".)
//   matched --accept--> accepted --begin--> in_progress
//   in_progress|changes_requested|client_review --propose--> changes_requested
//   changes_requested --respond--> client_review
//   accepted|in_progress|changes_requested|client_review --complete--> completed
//   any active --cancel--> cancelled (owner or admin)

export type ReviewStatus =
  | "requested"
  | "waitlist"
  | "matched"
  | "accepted"
  | "in_progress"
  | "changes_requested"
  | "client_review"
  | "completed"
  | "cancelled"

export type ReviewActor = "owner" | "lawyer" | "admin" | "system"

export type ReviewTransition =
  | "assign"
  | "decline"
  | "accept"
  | "begin"
  | "propose"
  | "respond"
  | "complete"
  | "cancel"

/** States in which the assigned lawyer may read and write review data. */
export const ACTIVE_REVIEW_STATUSES: ReadonlyArray<ReviewStatus> = [
  "matched",
  "accepted",
  "in_progress",
  "changes_requested",
  "client_review",
]

export function isActiveReviewStatus(status: string): boolean {
  return (ACTIVE_REVIEW_STATUSES as ReadonlyArray<string>).includes(status)
}

interface TransitionRule {
  from: ReadonlyArray<ReviewStatus>
  to: ReviewStatus
  actors: ReadonlyArray<ReviewActor>
}

const RULES: Record<ReviewTransition, TransitionRule> = {
  assign: { from: ["requested", "waitlist"], to: "matched", actors: ["admin", "system"] },
  decline: { from: ["matched"], to: "requested", actors: ["lawyer"] },
  accept: { from: ["matched"], to: "accepted", actors: ["lawyer"] },
  begin: { from: ["accepted"], to: "in_progress", actors: ["lawyer"] },
  propose: { from: ["in_progress", "changes_requested", "client_review"], to: "changes_requested", actors: ["lawyer"] },
  respond: { from: ["changes_requested"], to: "client_review", actors: ["owner"] },
  complete: { from: ["accepted", "in_progress", "changes_requested", "client_review"], to: "completed", actors: ["lawyer"] },
  cancel: {
    from: ["requested", "waitlist", "matched", "accepted", "in_progress", "changes_requested", "client_review"],
    to: "cancelled",
    actors: ["owner", "admin"],
  },
}

export function transitionTarget(
  transition: ReviewTransition,
  from: string,
  actor: ReviewActor
): { ok: true; to: ReviewStatus } | { ok: false; reason: string } {
  const rule = RULES[transition]
  if (!rule) return { ok: false, reason: "Unknown transition" }
  if (!(rule.from as ReadonlyArray<string>).includes(from)) {
    return { ok: false, reason: `Cannot ${transition} from ${from}` }
  }
  if (!rule.actors.includes(actor)) {
    return { ok: false, reason: `Actor ${actor} cannot ${transition}` }
  }
  return { ok: true, to: rule.to }
}
