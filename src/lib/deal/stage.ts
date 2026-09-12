/**
 * Deal stage derivation (UX architecture). Pure mapping from actual server
 * state to one obvious stage + one primary action. No invented states: every
 * stage corresponds to a backend status or to the presence of real outputs
 * (risk report, documents, versions). Anchors reference in-page sections.
 */

export type DealStageId =
  | "intake"
  | "analyzing"
  | "needs_info"
  | "ready_protect"
  | "ready_documents"
  | "lawyer_next"
  | "signing_next"
  | "completed"
  | "failed"

export interface DealPrimaryAction {
  label: string
  /** In-page anchor (e.g. "#deal-documents"). Always a real section. */
  target: string
}

export interface DealStage {
  stage: DealStageId
  headline: string
  sub: string
  primary: DealPrimaryAction | null
}

export interface DealStageInput {
  status: string
  hasContent: boolean
  hasRisk: boolean
  docsGenerated: boolean
  hasVersions: boolean
  /** Optional: known from the review section; deal-side fallback otherwise. */
  reviewActive?: boolean
  reviewRequested?: boolean
  signersPending?: number
  allSigned?: boolean
  completed?: boolean
}

export function dealStage(input: DealStageInput): DealStage {
  if (input.completed || input.status === "completed") {
    return {
      stage: "completed",
      headline: "Deal completed",
      sub: "The final record is below.",
      primary: { label: "View final documents", target: "#deal-documents" },
    }
  }
  if (input.status === "failed") {
    return {
      stage: "failed",
      headline: "Analysis needs another try",
      sub: "Your inputs are saved. Nothing was charged for the failed attempt.",
      primary: null,
    }
  }
  if (input.status === "processing" || input.status === "analyzing") {
    return {
      stage: "analyzing",
      headline: "Analyzing your deal",
      sub: "This usually takes under a minute. You can wait here.",
      primary: null,
    }
  }
  if (!input.hasContent) {
    return {
      stage: "intake",
      headline: "Describe your deal",
      sub: "Paste the brief or upload the document to begin.",
      primary: { label: "Add deal details", target: "#deal-intake" },
    }
  }
  if (input.hasContent && !input.hasRisk) {
    return {
      stage: "needs_info",
      headline: "Ready when you are",
      sub: "Add the details, then run the analysis.",
      primary: { label: "Review deal details", target: "#deal-intake" },
    }
  }
  if (input.allSigned) {
    return {
      stage: "signing_next",
      headline: "All signatures are in",
      sub: "Execution is derived automatically — see the final record.",
      primary: { label: "View execution status", target: "#deal-review" },
    }
  }
  if ((input.signersPending ?? 0) > 0) {
    return {
      stage: "signing_next",
      headline: `${input.signersPending} signature${input.signersPending === 1 ? "" : "s"} still needed`,
      sub: "Signing progress is tracked below.",
      primary: { label: "See signing status", target: "#deal-review" },
    }
  }
  if (input.reviewActive) {
    return {
      stage: "lawyer_next",
      headline: "Lawyer review in progress",
      sub: "Nothing for you to do right now — new comments will appear below.",
      primary: { label: "See review activity", target: "#deal-review" },
    }
  }
  if (input.reviewRequested) {
    return {
      stage: "lawyer_next",
      headline: "Lawyer matching",
      sub: "We are finding an eligible verified lawyer. No action needed.",
      primary: { label: "See review status", target: "#deal-review" },
    }
  }
  if (input.hasVersions || input.docsGenerated) {
    return {
      stage: "ready_documents",
      headline: "Documents are ready",
      sub: "Review the package, finalize a version, or invite signers.",
      primary: { label: "Review documents", target: "#deal-documents" },
    }
  }
  return {
    stage: "ready_protect",
    headline: "Analysis complete",
    sub: "Review the findings, then generate your protection package.",
    primary: { label: "See protection plan", target: "#deal-protection" },
  }
}
