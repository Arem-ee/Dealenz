// Business-owner priority tiers (Phase 27).
//
// Dealenz primarily serves founders/business owners. This helper makes
// the intended priority explicit in code so new features and product copy
// do not accidentally treat freelance as the canonical path.

import type { DealType } from "@/lib/deal-type"

export type PriorityTier = 1 | 2 | 3 | 4

export const VERTICAL_TIER: Record<DealType, PriorityTier> = {
  founder: 1,
  partnership: 1,
  purchase_sale: 2,
  lease: 2,
  employment: 2,
  freelance: 3,
  generic: 4,
}

export const TIER_LABEL: Record<PriorityTier, string> = {
  1: "Primary — founders & business owners",
  2: "Important — commercial deal types",
  3: "Supported — freelance",
  4: "Fallback — generic",
}

export function tierForDealType(dealType: string): PriorityTier | null {
  return (VERTICAL_TIER as Record<string, PriorityTier>)[dealType] ?? null
}

export function isPrimaryBusinessOwnerDealType(dealType: string): boolean {
  const tier = tierForDealType(dealType)
  return tier === 1
}
