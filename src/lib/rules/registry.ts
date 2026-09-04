// Rule registry (Phase 5D).
//
// Code-defined rules, versioned in git alongside the tests that pin them.
// Deterministic, explicit, testable: registration validates every rule,
// rejects key-plus-version collisions, and discovery filters by status and
// scope before anything evaluates. No database, no dynamic loading, no
// execution of anything that is not a validated Rule object.

import { evaluateRule, ruleApplies, type RuleResult } from "./result"
import { parseRule, type Rule, type RuleInput } from "./schema"
import type { AIOperation } from "@/lib/ai/operations"

// Re-exported for callers that only need the input shape from the registry.
export type { RuleInput }

const registry = new Map<string, Rule>()

function registrationKey(rule: Rule): string {
  return `${rule.ruleKey}@v${rule.version}`
}

export function registerRule(raw: unknown): Rule {
  const rule = parseRule(raw)
  const key = registrationKey(rule)
  if (registry.has(key)) {
    throw new Error(`Duplicate rule registration: ${key}`)
  }
  registry.set(key, rule)
  return rule
}

export function clearRegistry(): void {
  registry.clear()
}

export function getRegisteredRules(): Rule[] {
  return [...registry.values()]
}

// Discovery: active rules whose scope admits this operation and deal type.
// Nothing executes here; evaluation is a separate explicit step.
export function applicableRules(operation: AIOperation, dealType: string): Rule[] {
  return getRegisteredRules()
    .filter((rule) => ruleApplies(rule, operation, dealType))
    .sort((a, b) => b.priority - a.priority || a.ruleKey.localeCompare(b.ruleKey))
}

export interface EvaluationRun {
  results: RuleResult[]
  evaluatedAt: string
}

// Evaluates every applicable rule against one input bundle. Pure when the
// input is fixed: same rules plus same input always yield the same results.
export function evaluateApplicableRules(
  input: RuleInput,
  operation: AIOperation,
  dealType: string
): EvaluationRun {
  const results = applicableRules(operation, dealType).map((rule) => evaluateRule(rule, input))
  return { results, evaluatedAt: input.evaluatedAt }
}
