// Deterministic rule evaluator (Phase 5D).
//
// Pure and side-effect free: same rule plus same version plus same input
// always yields the same result. No LLM calls, no network, no database, no
// randomness, no wall-clock reads. Three-state logic (true/false/unknown)
// with explicit unknown propagation: missing information stays UNKNOWN and
// is never collapsed into PASS or FAIL by the evaluator itself.

import type { ComparisonOp, Condition, KnowledgeCondition, RuleInput, ValueCondition } from "./schema"

export type TriState = true | false | "unknown"

export interface ConditionEvaluation {
  outcome: TriState
  // Field paths that were unresolvable, for UNKNOWN reasons. Empty otherwise.
  unknownPaths: string[]
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

interface ResolvedValue {
  found: boolean
  unknown: boolean
  value: unknown
}

function resolvePath(input: RuleInput, path: string): ResolvedValue {
  const segments = path.split(".").filter((s) => s.length > 0)
  if (segments.length === 0) return { found: false, unknown: true, value: null }
  // Prototype-chain traversal can never resolve to a value: reads stay on
  // own properties only, and these segments resolve to unknown.
  if (segments.some((s) => s === "__proto__" || s === "constructor" || s === "prototype")) {
    return { found: false, unknown: true, value: null }
  }
  const [head, ...rest] = segments

  if (head === "context") {
    const key = rest[0]
    const field = (input.context.fields as Record<string, { value: unknown; source: string } | undefined>)[key]
    if (!field || rest.length !== 1) return { found: false, unknown: true, value: null }
    if (field.source === "unknown" || field.value === null) {
      return { found: true, unknown: true, value: null }
    }
    return { found: true, unknown: false, value: field.value }
  }
  if (head === "knowledge") {
    if (rest.length === 1 && rest[0] === "count") {
      return { found: true, unknown: false, value: input.knowledge.length }
    }
    return { found: false, unknown: true, value: null }
  }
  if (head === "operation") {
    return rest.length === 0
      ? { found: true, unknown: false, value: input.operation }
      : { found: false, unknown: true, value: null }
  }
  if (head === "intent" || head === "objective") {
    if (rest.length !== 0) return { found: false, unknown: true, value: null }
    const value = head === "intent" ? input.intent : input.objective
    if (value === undefined) return { found: true, unknown: true, value: null }
    return { found: true, unknown: false, value }
  }
  if (head === "facts") {
    let current: unknown = input.facts
    for (const segment of rest) {
      if (typeof current !== "object" || current === null || Array.isArray(current)) {
        return { found: false, unknown: true, value: null }
      }
      if (!Object.prototype.hasOwnProperty.call(current, segment)) {
        return { found: false, unknown: true, value: null }
      }
      current = (current as Record<string, unknown>)[segment]
    }
    if (current === undefined) return { found: false, unknown: true, value: null }
    return { found: true, unknown: false, value: current }
  }
  return { found: false, unknown: true, value: null }
}

function compareNumbers(op: ComparisonOp, actual: number, expected: number): TriState {
  switch (op) {
    case "gt":
      return actual > expected
    case "gte":
      return actual >= expected
    case "lt":
      return actual < expected
    case "lte":
      return actual <= expected
    default:
      return "unknown"
  }
}

function evaluateValueCondition(input: RuleInput, condition: ValueCondition): ConditionEvaluation {
  const resolved = resolvePath(input, condition.field)
  const unknownPaths = resolved.unknown || !resolved.found ? [condition.field] : []
  const { op } = condition

  if (op === "known") {
    return { outcome: !resolved.unknown && resolved.found, unknownPaths: [] }
  }
  if (op === "exists") {
    if (resolved.unknown || !resolved.found) return { outcome: false, unknownPaths: [] }
    return { outcome: !isEmpty(resolved.value), unknownPaths: [] }
  }
  if (op === "missing") {
    if (resolved.unknown || !resolved.found) return { outcome: true, unknownPaths: [] }
    return { outcome: isEmpty(resolved.value), unknownPaths: [] }
  }
  // Value comparisons cannot be decided without a known value.
  if (resolved.unknown || !resolved.found) return { outcome: "unknown", unknownPaths }

  const actual = resolved.value
  const expected = condition.value
  switch (op) {
    case "eq":
      return { outcome: actual === expected, unknownPaths: [] }
    case "neq":
      return { outcome: actual !== expected, unknownPaths: [] }
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      if (typeof actual !== "number" || typeof expected !== "number") {
        return { outcome: "unknown", unknownPaths }
      }
      return { outcome: compareNumbers(op, actual, expected), unknownPaths: [] }
    case "in":
      if (!Array.isArray(expected)) return { outcome: "unknown", unknownPaths }
      return { outcome: (expected as unknown[]).includes(actual), unknownPaths: [] }
    case "contains":
      if (Array.isArray(actual)) return { outcome: actual.includes(expected), unknownPaths: [] }
      if (typeof actual === "string" && typeof expected === "string") {
        return { outcome: actual.includes(expected), unknownPaths: [] }
      }
      return { outcome: "unknown", unknownPaths }
    default:
      return { outcome: "unknown", unknownPaths }
  }
}

function evaluateKnowledgeCondition(input: RuleInput, condition: KnowledgeCondition): ConditionEvaluation {
  const key = condition.knowledgePresent.itemKey
  const present =
    key === undefined
      ? input.knowledge.length > 0
      : input.knowledge.some((c) => c.itemKey === key)
  // Resolver output is known system state: a definite boolean, never unknown.
  return { outcome: present, unknownPaths: [] }
}

function mergeUnknown(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])]
}

// Evaluates a condition tree. Bounded and declarative: AND/OR/NOT over leaves,
// no loops, no function calls, no external access.
export function evaluateCondition(input: RuleInput, condition: Condition): ConditionEvaluation {
  if ("all" in condition) {
    let sawUnknown = false
    let paths: string[] = []
    for (const sub of condition.all) {
      const result = evaluateCondition(input, sub)
      if (result.outcome === false) return { outcome: false, unknownPaths: [] }
      if (result.outcome === "unknown") {
        sawUnknown = true
        paths = mergeUnknown(paths, result.unknownPaths)
      }
    }
    return sawUnknown ? { outcome: "unknown", unknownPaths: paths } : { outcome: true, unknownPaths: [] }
  }
  if ("any" in condition) {
    let sawUnknown = false
    let paths: string[] = []
    for (const sub of condition.any) {
      const result = evaluateCondition(input, sub)
      if (result.outcome === true) return { outcome: true, unknownPaths: [] }
      if (result.outcome === "unknown") {
        sawUnknown = true
        paths = mergeUnknown(paths, result.unknownPaths)
      }
    }
    return sawUnknown ? { outcome: "unknown", unknownPaths: paths } : { outcome: false, unknownPaths: [] }
  }
  if ("not" in condition) {
    const result = evaluateCondition(input, condition.not)
    if (result.outcome === "unknown") return result
    return { outcome: !result.outcome, unknownPaths: [] }
  }
  if ("knowledgePresent" in condition) {
    return evaluateKnowledgeCondition(input, condition)
  }
  return evaluateValueCondition(input, condition as ValueCondition)
}
