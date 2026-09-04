// Rule domain model (Phase 5D).
//
// A Rule is deterministic logic over known inputs — never an LLM judgment.
// It reads the ContextEnvelope, structured extracted facts, knowledge
// candidates, and the current operation, then yields PASS, FAIL, or UNKNOWN.
// Rules are code-defined and versioned in git (see registry.ts); no database
// table, no eval, no executable payloads anywhere in this model.

import type { AIOperation, UserIntent, UserObjective } from "@/lib/ai/operations"
import type { ContextEnvelope } from "@/lib/context/schema"
import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"

export type RuleStatus = "draft" | "active" | "retired"

export const RULE_STATUSES: readonly RuleStatus[] = ["draft", "active", "retired"]

// Small closed vocabulary. Categories describe what a rule inspects, not a
// legal taxonomy.
export type RuleCategory =
  | "context"
  | "knowledge"
  | "threshold"
  | "presence"
  | "absence"
  | "consistency"
  | "requirement"
  | "protection"

export const RULE_CATEGORIES: readonly RuleCategory[] = [
  "context",
  "knowledge",
  "threshold",
  "presence",
  "absence",
  "consistency",
  "requirement",
  "protection",
]

// Where a rule may run. Future verticals (lease, founder, ...) declare their
// deal type here without any vertical intelligence being built in this phase.
export interface RuleScope {
  operations?: AIOperation[]
  dealTypes?: Array<"freelance" | "generic" | string>
}

// Authority is explicit and never inflated. A rule grounded in curated
// knowledge references it; a heuristic product check declares product_policy
// and must never be presented as law.
export type RuleAuthority =
  | { kind: "knowledge"; itemKey: string; version?: number; note?: string }
  | { kind: "product_policy"; note: string }

export type ComparisonOp =
  | "exists"
  | "missing"
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains"
  | "known"

export interface ValueCondition {
  field: string
  op: ComparisonOp
  value?: unknown
}

export interface KnowledgeCondition {
  // True when at least one resolved candidate carries this item key.
  // Omitted key means any candidate counts. This observes resolver output
  // (known system state), never external legal truth.
  knowledgePresent: { itemKey?: string }
}

export interface AllCondition {
  all: Condition[]
}

export interface AnyCondition {
  any: Condition[]
}

export interface NotCondition {
  not: Condition
}

export type Condition = ValueCondition | KnowledgeCondition | AllCondition | AnyCondition | NotCondition

// Severity is author-declared per finding and explicitly NOT a risk score.
// No aggregation, no formula, no overall deal score is derived from findings
// in this phase.
export type FindingSeverity = "informational" | "attention" | "material" | "critical"

export const FINDING_SEVERITIES: readonly FindingSeverity[] = [
  "informational",
  "attention",
  "material",
  "critical",
]

export interface RuleFindingTemplate {
  // Plain finding language (a fact, not prose). Synthesis may explain it later.
  summary: string
  severity: FindingSeverity
  // Optional user-facing next step. Never a legal conclusion.
  guidance?: string
}

export interface Rule {
  ruleKey: string
  version: number
  title: string
  description: string
  status: RuleStatus
  // Higher runs first in evaluateAll output ordering. No scoring role.
  priority: number
  category: RuleCategory
  scope: RuleScope
  // The risk condition: true means the issue is present (FAIL with finding),
  // false means absent (PASS), unresolvable means UNKNOWN. Authors choose
  // polarity explicitly via fireOn; there is no hidden default reading.
  condition: Condition
  fireOn: boolean
  finding: RuleFindingTemplate
  authority: RuleAuthority
}

// The deterministic input bundle. ContextEnvelope is reused directly (never
// duplicated); facts are structured extracted values; knowledge carries
// resolver candidates; evaluatedAt is explicit so time never leaks in.
export interface RuleInput {
  context: ContextEnvelope
  facts: Record<string, unknown>
  knowledge: KnowledgeCandidate[]
  operation: AIOperation
  intent?: UserIntent
  objective?: UserObjective
  evaluatedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function shortText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max
}

const KEY_RE = /^[a-z0-9][a-z0-9-]{2,80}$/

function checkAuthority(raw: unknown): RuleAuthority {
  if (!isRecord(raw)) throw new Error("Rule has an invalid authority")
  if (raw.kind === "knowledge") {
    if (!shortText(raw.itemKey, 120)) throw new Error("Rule authority needs a knowledge itemKey")
    if (raw.version !== undefined && (typeof raw.version !== "number" || !Number.isInteger(raw.version) || raw.version < 1)) {
      throw new Error("Rule authority has an invalid knowledge version")
    }
    if (raw.note !== undefined && typeof raw.note !== "string") {
      throw new Error("Rule authority has an invalid note")
    }
    return { kind: "knowledge", itemKey: (raw.itemKey as string).trim(), version: raw.version as number | undefined, note: raw.note as string | undefined }
  }
  if (raw.kind === "product_policy") {
    if (!shortText(raw.note, 300)) throw new Error("Product-policy authority needs an explanatory note")
    return { kind: "product_policy", note: (raw.note as string).trim() }
  }
  throw new Error("Rule authority kind must be knowledge or product_policy")
}

const COMPARISON_OPS: readonly string[] = [
  "exists", "missing", "eq", "neq", "gt", "gte", "lt", "lte", "in", "contains", "known",
]

export function checkCondition(raw: unknown): Condition {
  if (!isRecord(raw)) throw new Error("Rule condition must be an object")
  if (Array.isArray((raw as Record<string, unknown>).all)) {
    const all = (raw as { all: unknown[] }).all
    if (all.length === 0 || all.length > 20) throw new Error("Rule all-condition must hold 1-20 sub-conditions")
    return { all: all.map(checkCondition) }
  }
  if (Array.isArray((raw as Record<string, unknown>).any)) {
    const any = (raw as { any: unknown[] }).any
    if (any.length === 0 || any.length > 20) throw new Error("Rule any-condition must hold 1-20 sub-conditions")
    return { any: any.map(checkCondition) }
  }
  if ((raw as Record<string, unknown>).not !== undefined) {
    return { not: checkCondition((raw as { not: unknown }).not) }
  }
  if ((raw as Record<string, unknown>).knowledgePresent !== undefined) {
    const kp = (raw as { knowledgePresent: unknown }).knowledgePresent
    if (!isRecord(kp)) throw new Error("Rule knowledgePresent must be an object")
    if (kp.itemKey !== undefined && !shortText(kp.itemKey, 120)) {
      throw new Error("Rule knowledgePresent has an invalid itemKey")
    }
    return { knowledgePresent: kp.itemKey === undefined ? {} : { itemKey: (kp.itemKey as string).trim() } }
  }
  const { field, op } = raw as { field?: unknown; op?: unknown }
  if (!shortText(field, 200)) throw new Error("Rule value condition needs a field path")
  if ((field as string).split(".").some((s) => s === "__proto__" || s === "constructor" || s === "prototype")) {
    throw new Error("Rule field paths must not traverse prototypes")
  }
  if (typeof op !== "string" || !COMPARISON_OPS.includes(op)) {
    throw new Error(`Rule has an invalid comparison op: ${String(op)}`)
  }
  // No executable payloads: conditions carry data only. Anything function-like
  // or carrying code strings is rejected here, before evaluation.
  const value = (raw as { value?: unknown }).value
  if (typeof value === "function") throw new Error("Rule conditions must not contain functions")
  if (typeof value === "string" && /eval\s*\(|Function\s*\(|=>/.test(value)) {
    throw new Error("Rule conditions must not contain code-like strings")
  }
  return { field: (field as string).trim(), op: op as ComparisonOp, value }
}

// Validates an unknown value into a Rule. Throws on anything malformed,
// including untrusted database-shaped input — nothing is executed, ever.
export function parseRule(raw: unknown): Rule {
  if (!isRecord(raw)) throw new Error("Rule must be an object")
  const { ruleKey, version, title, description, status, priority, category, scope, condition, fireOn, finding, authority } = raw
  if (typeof ruleKey !== "string" || !KEY_RE.test(ruleKey)) {
    throw new Error("Rule needs a kebab-case ruleKey (3-80 chars)")
  }
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new Error("Rule needs an integer version >= 1")
  }
  if (!shortText(title, 200)) throw new Error("Rule needs a title")
  if (!shortText(description, 1000)) throw new Error("Rule needs a description")
  if (!(RULE_STATUSES as readonly string[]).includes(status as string)) {
    throw new Error("Rule has an invalid status")
  }
  if (typeof priority !== "number" || !Number.isFinite(priority)) {
    throw new Error("Rule needs a numeric priority")
  }
  if (!(RULE_CATEGORIES as readonly string[]).includes(category as string)) {
    throw new Error("Rule has an invalid category")
  }
  if (!isRecord(scope)) throw new Error("Rule needs a scope object")
  const { operations, dealTypes } = scope as { operations?: unknown; dealTypes?: unknown }
  if (operations !== undefined && (!Array.isArray(operations) || !operations.every((o) => typeof o === "string"))) {
    throw new Error("Rule scope has invalid operations")
  }
  if (dealTypes !== undefined && (!Array.isArray(dealTypes) || !dealTypes.every((d) => typeof d === "string"))) {
    throw new Error("Rule scope has invalid dealTypes")
  }
  if (typeof fireOn !== "boolean") throw new Error("Rule needs an explicit fireOn polarity")
  if (!isRecord(finding)) throw new Error("Rule needs a finding template")
  const { summary, severity, guidance } = finding as Record<string, unknown>
  if (!shortText(summary, 500)) throw new Error("Rule finding needs a summary")
  if (!(FINDING_SEVERITIES as readonly string[]).includes(severity as string)) {
    throw new Error("Rule finding has an invalid severity")
  }
  if (guidance !== undefined && typeof guidance !== "string") {
    throw new Error("Rule finding has an invalid guidance")
  }
  if (guidance !== undefined && (guidance as string).includes("—")) {
    throw new Error("Rule finding guidance must not contain em dashes")
  }
  if ((summary as string).includes("—")) {
    throw new Error("Rule finding summary must not contain em dashes")
  }
  return {
    ruleKey,
    version,
    title: (title as string).trim(),
    description: (description as string).trim(),
    status: status as RuleStatus,
    priority,
    category: category as RuleCategory,
    scope: {
      operations: operations as AIOperation[] | undefined,
      dealTypes: dealTypes as string[] | undefined,
    },
    condition: checkCondition(condition),
    fireOn,
    finding: {
      summary: (summary as string).trim(),
      severity: severity as FindingSeverity,
      guidance: (guidance as string | undefined)?.trim() || undefined,
    },
    authority: checkAuthority(authority),
  }
}
