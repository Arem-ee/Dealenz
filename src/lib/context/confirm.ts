// User confirmation (Phase 5B).
//
// Applies user corrections to a stored envelope. Every update is validated
// against the context schema; a corrected value always becomes user_confirmed
// with the caller's confidence (default full). Unrelated fields are untouched.
// Version increments and bookkeeping (updatedAt/updatedBy) are set by the
// caller at persistence time so pure-domain tests stay deterministic.

import {
  parseContextEnvelope,
  type ContextEnvelope,
  type ContextField,
  type ContextFieldKey,
} from "./schema"

export type ConfirmationUpdate = {
  [K in ContextFieldKey]?: { value: unknown; confidence?: number }
}

export function applyUserConfirmation(
  existing: ContextEnvelope,
  updates: ConfirmationUpdate
): ContextEnvelope {
  const next = parseContextEnvelope(JSON.parse(JSON.stringify(existing)) as unknown)
  const keys = Object.keys(updates) as ContextFieldKey[]
  if (keys.length === 0) throw new Error("No context updates provided")
  for (const key of keys) {
    if (!(key in next.fields)) throw new Error(`Unknown context field "${key}"`)
    const update = updates[key]
    if (!update || typeof update !== "object") {
      throw new Error(`Context update for "${key}" is malformed`)
    }
    const confidence = update.confidence ?? 1
    if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence <= 0 || confidence > 1) {
      throw new Error(`Context update for "${key}" has an invalid confidence`)
    }
    ;(next.fields[key] as ContextField<never>) = {
      value: update.value as never,
      source: "user_confirmed",
      confidence,
    }
  }
  next.version += 1
  // Full-envelope validation: unknown keys, bad enums, bad types, and
  // source/value mismatches are all rejected here, before persistence.
  return parseContextEnvelope(next)
}
