// Deal moment states: the user's mental model, not pipeline internals.
// Every screen answers "what state is this deal in?" in this language:
// NEEDS ACTION (open issues), NEGOTIATING (movement via re-checks),
// READY TO SIGN (signing ceremony), SIGNED (history), GUARDED (watched
// obligations), NEEDS ATTENTION (failed/degraded), DRAFT/UNKNOWN otherwise.
// Pure and defensive: unknown inputs never produce a confident state.

export type DealMoment =
  | "needs-action"
  | "negotiating"
  | "ready-to-sign"
  | "signed"
  | "guarded"
  | "needs-attention"
  | "draft"
  | "unknown"

export interface DealMomentInput {
  status?: string | null
  openIssues?: number | null
  resolvedCount?: number | null
  executed?: boolean | null
  signingActive?: boolean | null
  hasMonitoring?: boolean | null
  rulesDegraded?: boolean | null
}

export const DEAL_MOMENT_LABEL: Record<DealMoment, string> = {
  "needs-action": "Needs action",
  negotiating: "Negotiating",
  "ready-to-sign": "Ready to sign",
  signed: "Signed",
  guarded: "Guarded",
  "needs-attention": "Needs attention",
  draft: "Draft",
  unknown: "Unknown",
}

export function dealMomentState(input: DealMomentInput): DealMoment {
  if (input.executed) {
    return input.hasMonitoring ? "guarded" : "signed"
  }
  if (input.status === "failed" || input.rulesDegraded) {
    return "needs-attention"
  }
  if (input.signingActive) {
    return "ready-to-sign"
  }
  const open = typeof input.openIssues === "number" ? input.openIssues : null
  const resolved = typeof input.resolvedCount === "number" ? input.resolvedCount : 0
  if (open !== null && open > 0) {
    return resolved > 0 ? "negotiating" : "needs-action"
  }
  if (input.status === "draft" || input.status === "processing" || input.status === "in_progress") {
    return "draft"
  }
  if (open === 0) {
    return resolved > 0 ? "negotiating" : "unknown"
  }
  return "unknown"
}
