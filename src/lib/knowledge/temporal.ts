// Temporal semantics for Knowledge Items (Phase 5C).
//
// Small deterministic helpers only — not a temporal database. Dates are ISO
// YYYY-MM-DD strings compared lexicographically (safe for this fixed format).

import type { KnowledgeItem } from "./schema"

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// Whether the item was effective on the given date. Open-ended items
// (effectiveTo null) are effective from effectiveFrom onward.
export function isEffectiveAt(item: KnowledgeItem, date: Date | string): boolean {
  const day = typeof date === "string" ? date.slice(0, 10) : toISODate(date)
  if (day < item.effectiveFrom) return false
  if (item.effectiveTo !== null && day > item.effectiveTo) return false
  return true
}
