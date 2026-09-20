// Work-first workspace derivation (frontend model).
//
// Pure: same thread state in, same workspace description out. The workspace
// mode answers "what is this deal thread about right now" so the work
// surface can lead and the conversation can stay a narrow control layer.
// Modes mirror real backend state only: plan kind/status, execution status,
// the user's classified objective, the latest structured message, signing
// participation, and verified counts (monitoring events, document versions).
// Nothing here invents state; ChatThread supplies the inputs from
// authoritative reads and this module only names what they mean.

export type WorkspaceMode =
  | "approval"
  | "executing"
  | "protection"
  | "proposal"
  | "negotiation"
  | "draft"
  | "signing"
  | "confirm"
  | "review"
  | "lawyer"
  | "monitoring"
  | "idle"

export interface WorkspaceInput {
  planStatus?: string | null
  planObjectiveKind?: string | null
  executionStatus?: string | null
  /** Classified user objective (lib/conversation/classify, client-safe). */
  operation?: string | null
  latestRichType?: string | null
  monitoringCount?: number | null
  documentCount?: number | null
  signerCount?: number | null
  /** True when versions sit beyond draft or signers are engaged. */
  activeSigning?: boolean | null
}

export interface WorkspaceDescription {
  mode: WorkspaceMode
  title: string
  description: string
}

const RICH_MODE: Record<string, WorkspaceMode> = {
  context_confirm: "confirm",
  risk_report: "review",
  document_draft: "draft",
  document_draft_turn: "draft",
  lawyer_recommendation: "lawyer",
}

const OPERATION_MODE: Record<string, WorkspaceMode> = {
  proposal: "proposal",
  negotiation: "negotiation",
  drafting: "draft",
}

export function describeWorkspace(input: WorkspaceInput): WorkspaceDescription {
  const monitoringCount = input.monitoringCount ?? 0
  const documentCount = input.documentCount ?? 0
  const signerCount = input.signerCount ?? 0

  // Approval-gated and running work dominate: the user has a decision or
  // in-flight execution regardless of what the latest card shows.
  if (input.planStatus === "awaiting_approval" || input.planStatus === "needs_input") {
    return {
      mode: "approval",
      title: "Plan needs your approval",
      description: "Review the proposed work and cost. Nothing runs until you approve.",
    }
  }
  if (
    input.planStatus === "approved" ||
    input.planStatus === "executing" ||
    (input.executionStatus !== null &&
      input.executionStatus !== undefined &&
      ["pending", "running"].includes(input.executionStatus))
  ) {
    return {
      mode: "executing",
      title: "Work in progress",
      description: "Dealenz is running the approved steps. Results land here.",
    }
  }

  // An active protection plan names the workspace even when the latest
  // card is older analysis output. (proposal_batch plans no longer capture
  // the workspace: bulk outreach is off-thesis and its creation surface is
  // removed; grandfathered plans fall through to card/operation modes and
  // remain approvable and executable.)
  if (input.planObjectiveKind === "protection") {
    return {
      mode: "protection",
      title: "Protection workspace",
      description: "Recommended protection, checklist, and generated output.",
    }
  }

  // The user's classified objective selects the workspace shape.
  const objectiveMode = input.operation ? OPERATION_MODE[input.operation] : undefined
  if (objectiveMode) {
    if (objectiveMode === "proposal") {
      return {
        mode: "proposal",
        title: "Proposal workspace",
        description: "The proposal output with its context, assumptions, and next actions.",
      }
    }
    if (objectiveMode === "negotiation") {
      return {
        mode: "negotiation",
        title: "Negotiation preparation",
        description: "Key issues, evidence, and preparation for the negotiation.",
      }
    }
    return {
      mode: "draft",
      title: "Draft workspace",
      description: "Generated drafts with their assumptions and open inputs.",
    }
  }

  // People signing beats older cards: the deal is in motion.
  if (signerCount > 0 || input.activeSigning) {
    return {
      mode: "signing",
      title: "Signing workspace",
      description: "Document versions, signer state, and what happens next.",
    }
  }

  const rich = input.latestRichType ? RICH_MODE[input.latestRichType] : undefined
  if (rich === "confirm") {
    return {
      mode: "confirm",
      title: "Confirm the details",
      description: "Check these deal details so the analysis works from facts, not guesses.",
    }
  }
  if (rich === "review") {
    return {
      mode: "review",
      title: "Contract review",
      description: "What Dealenz found, why it matters, and what to do next.",
    }
  }
  if (rich === "draft") {
    return {
      mode: "draft",
      title: "Draft workspace",
      description: "The generated draft with its assumptions and open inputs.",
    }
  }
  if (rich === "lawyer") {
    return {
      mode: "lawyer",
      title: "Lawyer review",
      description: "A professional review was recommended for this deal.",
    }
  }

  if (monitoringCount > 0) {
    return {
      mode: "monitoring",
      title: "Deal monitoring",
      description: "Watched conditions and events for this deal.",
    }
  }
  if (documentCount > 0) {
    return {
      mode: "draft",
      title: "Documents",
      description: "Generated documents and signing state for this deal.",
    }
  }
  return {
    mode: "idle",
    title: "Deal workspace",
    description: "Share the deal or ask a question to start the work.",
  }
}
