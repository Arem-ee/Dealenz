import { parseContextEnvelope } from "./schema"
import { evaluateContextGate } from "./gate"
import type { DealType } from "./schema"
import { optionsForContextKey } from "./options"

export interface ConfirmField {
  key: string
  label: string
  value: string
  confidence: number
  options: string[] | null
}

// Single choke point for "what should we ask the user before analysis can
// run". Used by both the direct analysis path and the plan executor, so the
// one-question confirm card appears no matter which route stalls on context.
// Returns null when there is nothing to ask (READY) or when the stored
// envelope is unusable — callers treat null as "proceed", never as failure.
export function buildConfirmFields(envelope: unknown, dealType: string): ConfirmField[] | null {
  let parsed = null
  try {
    parsed = parseContextEnvelope(envelope)
  } catch {
    return null
  }
  const gate = evaluateContextGate(parsed, (dealType || "generic") as DealType)
  if (!gate || gate.state === "READY") return null
  const fields = (envelope as { fields?: Record<string, { value?: unknown; confidence?: number }> } | null)?.fields ?? {}
  return [...gate.missingRequired, ...gate.unconfirmedRequired].slice(0, 3).map((k) => {
    const f = fields[k] ?? {}
    return {
      key: k,
      label: k.replace(/([A-Z])/g, " $1").replace(/_/g, " "),
      value: String(f.value ?? ""),
      confidence: typeof f.confidence === "number" ? f.confidence : 0,
      options: optionsForContextKey(k),
    }
  })
}
