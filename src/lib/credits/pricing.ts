// First priced credit policy (Phase 5G).
//
// Operation-based flat prices per output-budget tier. These are provisional
// product decisions, not measured economics: product.md requires roughly a
// week of real token-usage measurement before prices freeze, so treat these
// as the starting point for that exercise, not the final word. Deliberately
// NOT derived from provider tokens: measured tokens are recorded on every
// AIUsageRecord for the future pricing review, but the charge is a flat
// per-operation price. No token-to-credit rate exists anywhere here.

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

export function priceForOperation(operation: AIOperation): number {
  const budget = resolveOperationProfile(operation).outputBudget
  if (budget === "brief") return CREDIT_PRICE_BRIEF
  if (budget === "standard") return CREDIT_PRICE_STANDARD
  return CREDIT_PRICE_EXTENDED
}

export const STANDARD_CREDIT_POLICY: CreditPolicy = {
  estimateMaxCredits(operation: AIOperation): number {
    return priceForOperation(operation)
  },
  creditsForUsage(record: AIUsageRecord): number {
    // Flat operation price. The measured tokens on the record inform future
    // pricing reviews; they do not change this charge.
    return priceForOperation(record.operation)
  },
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

// Gated product actions (credit-only access control — no plans, no flags).
// Small operations deliberately sit at or below the free-signup grant so a
// new account can genuinely try the product; larger ones require purchase.
// Same balance check as every other billable operation.
export const SIGNUP_GRANT_CREDITS = 10
export const UPLOAD_CREDITS = 5
export const SIGNATURE_SEND_CREDITS = 10
export const LAWYER_REQUEST_CREDITS = 10
