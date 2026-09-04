// Context completeness gate (Phase 5B).
//
// Evaluates whether sufficient context exists for analysis to proceed. Three
// states, never a bare "context exists" check:
//   READY — every required field is known and confirmed (or high-confidence inferred).
//   NEEDS_CONFIRMATION — a required field is inferred but below the confirmation threshold.
//   MISSING_REQUIRED_CONTEXT — a required field is unknown (or the deal type itself is unknown).
// Optional fields never block, whatever their state.

import type { ContextEnvelope, ContextFieldKey, DealType } from "./schema"
import { CONFIRMATION_THRESHOLD, requiredContextFields } from "./requirements"

export type ContextGateState = "READY" | "NEEDS_CONFIRMATION" | "MISSING_REQUIRED_CONTEXT"

export interface ContextGateResult {
  state: ContextGateState
  // Required fields with no usable value.
  missingRequired: ContextFieldKey[]
  // Required fields holding a low-confidence inference the user must confirm.
  unconfirmedRequired: ContextFieldKey[]
  // Human-readable explanation for UI and logs (no sensitive content).
  detail: string
}

export function evaluateContextGate(
  envelope: ContextEnvelope | null,
  dealType: DealType
): ContextGateResult {
  if (!envelope) {
    return {
      state: "MISSING_REQUIRED_CONTEXT",
      missingRequired: ["dealType"],
      unconfirmedRequired: [],
      detail: "No context has been resolved for this deal yet.",
    }
  }

  const required = requiredContextFields(dealType)
  const missingRequired: ContextFieldKey[] = []
  const unconfirmedRequired: ContextFieldKey[] = []

  for (const key of required) {
    const field = envelope.fields[key]
    if (!field || field.source === "unknown" || field.value === null) {
      missingRequired.push(key)
      continue
    }
    if (field.source === "inferred" && field.confidence < CONFIRMATION_THRESHOLD) {
      unconfirmedRequired.push(key)
    }
  }

  if (missingRequired.length > 0) {
    return {
      state: "MISSING_REQUIRED_CONTEXT",
      missingRequired,
      unconfirmedRequired,
      detail: `Missing required context: ${missingRequired.join(", ")}.`,
    }
  }
  if (unconfirmedRequired.length > 0) {
    return {
      state: "NEEDS_CONFIRMATION",
      missingRequired,
      unconfirmedRequired,
      detail: `Please confirm: ${unconfirmedRequired.join(", ")}.`,
    }
  }
  return {
    state: "READY",
    missingRequired,
    unconfirmedRequired,
    detail: "Context is sufficient to proceed.",
  }
}
