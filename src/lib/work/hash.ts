// Deterministic payload hashing for plan approval (Phase 23C).
//
// Canonical JSON (sorted keys) → djb2 hex, same as evidenceId.
// Immutable binding: approval's approved_payload_hash must equal
// current plan's payload_hash, or it cannot authorize the plan.

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`
}

export function payloadHash(input: unknown): string {
  const text = canonicalJson(input)
  let hash = 5381
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0
  return `ph_${hash.toString(16).padStart(8, "0")}_${text.length.toString(36)}`
}

// Canonical payload for a plan version: objective + objectiveKind + steps (ordered) + estimatedCredits
export function planPayloadHash(input: {
  objective: string
  objectiveKind: string
  estimatedCredits: number
  steps: Array<{ operation: string; inputRef: unknown; dependsOn: string[]; estimatedCredits: number }>
}): string {
  return payloadHash({
    objective: input.objective.trim(),
    objectiveKind: input.objectiveKind,
    estimatedCredits: input.estimatedCredits,
    steps: input.steps.map((s) => ({
      operation: s.operation,
      inputRef: s.inputRef ?? {},
      dependsOn: [...s.dependsOn].sort(),
      estimatedCredits: s.estimatedCredits,
    })),
  })
}
