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
// rounded to small integers so simple questions stay cheap and deep analysis
// costs meaningfully more. Greetings never reach pricing (deterministic
// fast-path, no computation, no charge).
export const CREDIT_PRICE_BRIEF = 1
export const CREDIT_PRICE_STANDARD = 3
export const CREDIT_PRICE_EXTENDED = 8

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
