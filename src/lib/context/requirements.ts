// Required-context policy (Phase 5B).
//
// Determines which context fields are required for a deal type. The baseline
// is deliberately minimal and generic: only the user-confirmed deal type is
// required to proceed. No specialized legal or deal-type rules live here —
// future deal-type modules extend the policy through registerContextRequirements
// instead of scattering conditionals through the analysis pipeline.

import type { ContextFieldKey, DealType } from "./schema"

// Baseline: deal type must be known and confirmed. Everything else is optional
// until a future module declares otherwise. Lease, purchase_sale,
// employment, and founder deliberately add no extra requirements: their
// workflows proceed safely on the same minimal baseline.
const BASELINE_REQUIREMENTS: Record<DealType, ContextFieldKey[]> = {
  freelance: ["dealType"],
  generic: ["dealType"],
  lease: ["dealType"],
  purchase_sale: ["dealType"],
  employment: ["dealType"],
  founder: ["dealType"],
}

// Extension hook for future deal-type modules. Phase 5B registers nothing;
// the hook exists so later phases declare requirements without touching the gate.
const extraRequirements = new Map<string, ContextFieldKey[]>()

export function registerContextRequirements(dealType: string, fields: ContextFieldKey[]): void {
  extraRequirements.set(dealType, [...fields])
}

export function requiredContextFields(dealType: DealType): ContextFieldKey[] {
  const base = BASELINE_REQUIREMENTS[dealType] ?? ["dealType"]
  const extra = extraRequirements.get(dealType) ?? []
  return [...new Set([...base, ...extra])]
}

// Inferred fields below this confidence must be confirmed by the user before
// they satisfy a requirement. Inferred fields at or above it are accepted.
// The threshold is a product constant, not a legal judgment.
export const CONFIRMATION_THRESHOLD = 0.75
