// First priced credit policy (Phase 5G), length-priced for conversation.
// Operation tiers price the WORK (output budgets brief 1024 / standard 2048
// / extended 8192); input-length tiers price the MATERIAL (quick 1 / brief 2
// / standard 6 / extended 25 by user-text characters). Brief-tier asks pay
// purely by material; standard/extended asks keep their tier as a floor.
// Estimate and charge share one function, so quotes equal charges. Measured
// provider tokens are recorded on every AIUsageRecord for future pricing
// reviews but never converted at a token rate: the user pays for what they
// send plus the work they request, never our prompt overhead.

import { resolveOperationProfile, type AIOperation } from "@/lib/ai/operations"
import type { AIUsageRecord, CreditPolicy } from "@/lib/ai/usage"

// Provisional tier prices in credits. Rationale: proportional to the output
// budgets the tiers authorize (brief 1024, standard 2048, extended 8192),
// scaled so simple questions stay cheap and deep analysis costs meaningfully
// more. Rescaled 2/6/25 (was 10/30/100): a 10-credit signup grant buys five
// back-and-forths, and a deep answer still costs more than any single
// document draft. Greetings never reach pricing (deterministic fast-path, no
// computation, no charge).
export const CREDIT_PRICE_BRIEF = 2
export const CREDIT_PRICE_STANDARD = 6
export const CREDIT_PRICE_EXTENDED = 25

// Clarification rate: answering Dealenz's own follow-up question with a
// short factual answer (e.g. "Lagos, Nigeria") is priced below the brief
// tier. Without this, the one-question-at-a-time contract taxes users once
// per missing field for information the system asked for. Guards: the reply
// must be short, contain no question of its own, and directly follow a
// single-question assistant turn — and only brief-tier operations qualify,
// so a short "draft my proposal" can never ride the discount into a
// standard/extended operation.
export const CLARIFICATION_CREDITS = 1
export const CLARIFICATION_MAX_CHARS = 280

export const CLARIFICATION_POLICY: CreditPolicy = {
  estimateMaxCredits(): number {
    return CLARIFICATION_CREDITS
  },
  creditsForUsage(): number {
    return CLARIFICATION_CREDITS
  },
}

export interface ClarificationTurn {
  role: string
  text: string
}

export function isClarificationTurn(history: ReadonlyArray<ClarificationTurn>, text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0 || trimmed.length > CLARIFICATION_MAX_CHARS) return false
  // An answer, not a new question.
  if (trimmed.includes("?")) return false
  const last = history.length > 0 ? history[history.length - 1] : null
  if (!last || last.role !== "assistant") return false
  // The system asked exactly one question: this turn answers it. Anything
  // else (statement, multi-question violation) pays the normal price.
  const questions = (last.text.match(/\?/g) ?? []).length
  return questions === 1
}

export function priceForOperation(operation: AIOperation): number {
  const budget = resolveOperationProfile(operation).outputBudget
  if (budget === "brief") return CREDIT_PRICE_BRIEF
  if (budget === "standard") return CREDIT_PRICE_STANDARD
  return CREDIT_PRICE_EXTENDED
}

// Input-length tiers (user-text characters, roughly 4 chars per token).
// The operation tier prices the WORK (output budget); the length tier prices
// the MATERIAL (how much the user pasted). A 20-word question costs 1, a
// pasted contract costs extended — without this, both paid flat brief and
// neither price was honest. Deliberately character-based, not token-based:
// deterministic, explainable before the call, and independent of provider
// tokenizers. Only the user's own text counts — findings, knowledge, history
// and system prompts the pipeline adds are our cost, never billed.
export const INPUT_TIER_QUICK_MAX = 280
export const INPUT_TIER_BRIEF_MAX = 2000
export const INPUT_TIER_STANDARD_MAX = 8000

export const CREDIT_PRICE_QUICK = 1

export function priceForInputLength(chars: number): number {
  if (!Number.isFinite(chars) || chars <= INPUT_TIER_QUICK_MAX) return CREDIT_PRICE_QUICK
  if (chars <= INPUT_TIER_BRIEF_MAX) return CREDIT_PRICE_BRIEF
  if (chars <= INPUT_TIER_STANDARD_MAX) return CREDIT_PRICE_STANDARD
  return CREDIT_PRICE_EXTENDED
}

// Ask pricing: brief-tier work is priced purely by material (a basic
// question costs 1, a pasted contract costs up to extended); standard and
// extended work keeps its tier as a floor and length can only raise it — a
// short "draft my proposal" still pays the standard tier for the work
// requested. Estimate and charge use this same function, so the quoted
// price is always the paid price.
export function priceForAskChars(chars: number, operation: AIOperation): number {
  const lengthPrice = priceForInputLength(chars)
  const operationPrice = priceForOperation(operation)
  if (operationPrice === CREDIT_PRICE_BRIEF) return lengthPrice
  return Math.max(operationPrice, lengthPrice)
}

export function priceForAsk(text: string, operation: AIOperation): number {
  const length = typeof text === "string" ? text.trim().length : 0
  return priceForAskChars(length, operation)
}

export const STANDARD_CREDIT_POLICY: CreditPolicy = {
  estimateMaxCredits(operation: AIOperation, inputChars?: number): number {
    if (typeof inputChars === "number") return priceForAskChars(inputChars, operation)
    return priceForOperation(operation)
  },
  creditsForUsage(record: AIUsageRecord): number {
    // Settle-down: the final is the higher of material price (what the user
    // sent) and output price (what was delivered), capped by the estimate —
    // the quote is a ceiling and the final only stays or drops, never rises.
    // For brief work the cap equals the input price, so output never matters
    // there; standard/extended answers that land short refund the difference.
    // Unmeasured output (no telemetry) settles at the estimate formula:
    // discounts require measured proof, never absence. Non-conversation
    // callers carry no inputChars and keep the flat operation price.
    if (typeof record.inputChars !== "number") {
      return priceForOperation(record.operation)
    }
    const estimate = priceForAskChars(record.inputChars, record.operation)
    if (typeof record.outputTokens !== "number") {
      return estimate
    }
    return Math.min(estimate, Math.max(priceForInputLength(record.inputChars), priceForOutputTokens(record.outputTokens)))
  },
}

// Output tiers (measured provider output tokens). Thresholds align with the
// output budgets so a tier's cap prices at its own tier: brief answers top
// out at brief price, standard at standard, extended at extended. Coarse
// buckets on purpose — provider verbosity within a bucket is free, so no
// tokenizer or model chattiness can nickel-and-dime the user.
export const OUTPUT_TIER_QUICK_MAX = 256
export const OUTPUT_TIER_BRIEF_MAX = 1024
export const OUTPUT_TIER_STANDARD_MAX = 2048

export function priceForOutputTokens(tokens: number): number {
  if (!Number.isFinite(tokens) || tokens <= OUTPUT_TIER_QUICK_MAX) return CREDIT_PRICE_QUICK
  if (tokens <= OUTPUT_TIER_BRIEF_MAX) return CREDIT_PRICE_BRIEF
  if (tokens <= OUTPUT_TIER_STANDARD_MAX) return CREDIT_PRICE_STANDARD
  return CREDIT_PRICE_EXTENDED
}

// Per-document generation costs, keyed by document family. These price the
// work-plan generate_draft steps (estimates in protection/batch planning and
// measured consumption in the executor). Any type outside the four priced
// families (e.g. protection_clause, outreach micro-drafts) costs 1 credit,
// preserving the pre-recalibration micro-draft rate.
export const DOCUMENT_CREDIT_COSTS = {
  proposal: 10,
  sow: 15,
  contract: 20,
  checklist: 10,
} as const

export function creditsForDocumentType(documentType: string | null | undefined): number {
  const key = (documentType ?? "").trim().toLowerCase()
  if (key === "proposal") return DOCUMENT_CREDIT_COSTS.proposal
  if (key === "sow" || key === "statement_of_work" || key === "statement-of-work") return DOCUMENT_CREDIT_COSTS.sow
  if (key === "contract") return DOCUMENT_CREDIT_COSTS.contract
  if (key === "checklist") return DOCUMENT_CREDIT_COSTS.checklist
  return 1
}

// Deal analysis (extract + deterministic rules + risk report) costs 5
// credits: the signup grant covers the first two. There is no free daily
// allowance anymore — credits are the only gate.
export const ANALYSIS_CREDITS = 5

// Top-up nudge threshold: below the signup grant means the account cannot
// do meaningful work without topping up (a single analysis costs 5). Shown
// only then — never as a standing upsell.
export const LOW_CREDIT_THRESHOLD = 10

// Counterparty research: entity resolution is brief-tier micro work (1
// credit, the same floor as outreach micro-drafts); the research run itself
// prices through the standard tier via priceForOperation("counterparty_research").
export const COUNTERPARTY_RESOLVE_CREDITS = 1

// Gated product actions (credit-only access control — no plans, no flags).
// Small operations deliberately sit at or below the free-signup grant so a
// new account can genuinely try the product; larger ones require purchase.
// Same balance check as every other billable operation.
export const SIGNUP_GRANT_CREDITS = 10
export const UPLOAD_CREDITS = 5
export const SIGNATURE_SEND_CREDITS = 10
export const LAWYER_REQUEST_CREDITS = 10
