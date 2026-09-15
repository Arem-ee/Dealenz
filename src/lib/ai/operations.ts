// AI operations, intent, and objectives (pre-5D correction).
//
// Establishes that an AI request can originate from several product operations
// — document analysis is one of them, conversation is another — while INPUT
// stays distinct from INTENT (an uploaded document is not automatically a
// "review"; pasted text is not automatically a question). Nothing here builds
// a chat UI, a classifier, or a billing system; it is the vocabulary plus the
// per-operation execution policy (output budget tier, context selection) that
// later phases implement against.

// Where an AI request can originate. Names follow the existing product
// surfaces (document analysis, negotiation, drafting already exist as code).
export type AIOperation =
  | "document_analysis"
  | "conversation"
  | "consultation"
  | "negotiation"
  | "drafting"
  | "comparison"
  | "explanation"
  | "decision_support"

export const AI_OPERATIONS: readonly AIOperation[] = [
  "document_analysis",
  "conversation",
  "consultation",
  "negotiation",
  "drafting",
  "comparison",
  "explanation",
  "decision_support",
]

// What the user is trying to accomplish. Deliberately small: intent refines
// depth and shape of the response, it does not gate access to capabilities.
export type UserIntent =
  | "explore"
  | "understand"
  | "evaluate"
  | "negotiate"
  | "draft"
  | "compare"
  | "review"
  | "decide"

// What the user is trying to achieve, preserved separately from deal facts,
// knowledge, rules, findings, and AI explanation.
export type UserObjective =
  | "maximize_payment"
  | "protect_ownership"
  | "reduce_liability"
  | "understand_obligations"
  | "decide_whether_to_accept"
  | "prepare_negotiation"
  | "compare_alternatives"

export const USER_OBJECTIVES: readonly UserObjective[] = [
  "maximize_payment",
  "protect_ownership",
  "reduce_liability",
  "understand_obligations",
  "decide_whether_to_accept",
  "prepare_negotiation",
  "compare_alternatives",
]

// Future input kinds (image/audio/video) extend this union; handlers for them
// do not exist yet. A conversation may carry no document at all.
export type AIRequestInput =
  | { kind: "text"; text: string }
  | { kind: "document"; auditId: string; text?: string }
  | { kind: "mixed"; text: string; auditId: string }

// Output budget tiers (max output tokens). Grounded in current usage: the
// codebase default is 8192 (deep analysis) and negotiation points use 1000
// (brief). Tiers are tunable product constants, not a pricing model.
export const OUTPUT_BUDGET_BRIEF = 1024
export const OUTPUT_BUDGET_STANDARD = 2048
export const OUTPUT_BUDGET_EXTENDED = 8192

export type OutputBudget = "brief" | "standard" | "extended"

export function maxTokensForBudget(budget: OutputBudget): number {
  switch (budget) {
    case "brief":
      return OUTPUT_BUDGET_BRIEF
    case "standard":
      return OUTPUT_BUDGET_STANDARD
    case "extended":
      return OUTPUT_BUDGET_EXTENDED
  }
}

// How much surrounding context an operation may assemble. Simple questions
// take the minimum necessary; deep analysis takes relevant expanded context.
// More context is not automatically better (cost and answer quality both).
export type ContextSelection = "minimal" | "standard" | "expanded"

export interface OperationProfile {
  operation: AIOperation
  // Whether the operation is meaningless without a document attached.
  // document_analysis requires input; conversation explicitly does not.
  requiresDocument: boolean
  // Whether the context completeness gate must pass before running.
  // Only document_analysis is gate-enforced today; other operations may
  // still read context opportunistically when a document is attached.
  requiresContext: boolean
  // Whether the operation has a deterministic-rules consumer. Conversation,
  // comparison, explanation, and decision support evaluate rules whenever a
  // document is attached; drafting has no consumer yet.
  usesRules: boolean
  defaultIntent: UserIntent
  outputBudget: OutputBudget
  contextSelection: ContextSelection
}

const OPERATION_PROFILES: Record<AIOperation, OperationProfile> = {
  document_analysis: {
    operation: "document_analysis",
    requiresDocument: true,
    requiresContext: true,
    usesRules: true,
    defaultIntent: "review",
    outputBudget: "extended",
    contextSelection: "expanded",
  },
  conversation: {
    operation: "conversation",
    requiresDocument: false,
    requiresContext: false,
    usesRules: true,
    defaultIntent: "explore",
    outputBudget: "brief",
    contextSelection: "minimal",
  },
  consultation: {
    operation: "consultation",
    requiresDocument: false,
    requiresContext: false,
    usesRules: false,
    defaultIntent: "explore",
    outputBudget: "brief",
    contextSelection: "minimal",
  },
  negotiation: {
    operation: "negotiation",
    requiresDocument: false,
    requiresContext: false,
    usesRules: true,
    defaultIntent: "negotiate",
    outputBudget: "brief",
    contextSelection: "standard",
  },
  drafting: {
    operation: "drafting",
    requiresDocument: false,
    requiresContext: false,
    usesRules: false,
    defaultIntent: "draft",
    outputBudget: "standard",
    contextSelection: "standard",
  },
  comparison: {
    operation: "comparison",
    requiresDocument: false,
    requiresContext: false,
    usesRules: true,
    defaultIntent: "compare",
    outputBudget: "standard",
    contextSelection: "standard",
  },
  explanation: {
    operation: "explanation",
    requiresDocument: false,
    requiresContext: false,
    usesRules: true,
    defaultIntent: "understand",
    outputBudget: "brief",
    contextSelection: "minimal",
  },
  decision_support: {
    operation: "decision_support",
    requiresDocument: false,
    requiresContext: false,
    usesRules: true,
    defaultIntent: "decide",
    outputBudget: "standard",
    contextSelection: "standard",
  },
}

export function resolveOperationProfile(operation: AIOperation): OperationProfile {
  return OPERATION_PROFILES[operation]
}

export function maxTokensForOperation(operation: AIOperation): number {
  return maxTokensForBudget(resolveOperationProfile(operation).outputBudget)
}

// Provider-reported token usage. Pure measurement, never a user price.
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export function totalTokens(usage: TokenUsage): number {
  return usage.inputTokens + usage.outputTokens
}

// What adapters return: text for the domain layer plus optional measured
// usage. Usage is absent when the provider does not report it — never zeroed
// or fabricated, so downstream accounting can distinguish "measured zero"
// from "not reported".
export interface ProviderResult {
  text: string
  usage?: TokenUsage
}
