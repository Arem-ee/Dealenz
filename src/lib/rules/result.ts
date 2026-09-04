// Rule results and findings (Phase 5D).
//
// A RuleResult is an internal authority object: what fired, why, under which
// authority, and when. It is never user-facing prose. Findings state facts
// ("Payment term is missing."); AI synthesis may later explain them ("I would
// clarify the payment date..."). The two must never be mixed, and synthesis
// must never silently flip a deterministic status (see detectFindingConflicts).

import { evaluateCondition } from "./evaluator"
import type {
  FindingSeverity,
  Rule,
  RuleAuthority,
  RuleInput,
} from "./schema"

export type RuleResultStatus = "PASS" | "FAIL" | "UNKNOWN"

export interface Finding {
  ruleKey: string
  ruleVersion: number
  summary: string
  severity: FindingSeverity
  guidance?: string
  authority: RuleAuthority
}

export interface RuleResult {
  ruleKey: string
  ruleVersion: string
  status: RuleResultStatus
  // Present on FAIL only. PASS carries no finding; UNKNOWN carries a reason.
  finding?: Finding
  reason: string
  authority: RuleAuthority
  // ISO timestamp copied from the explicit evaluation input, never wall-clock.
  evaluatedAt: string
}

export function ruleApplies(rule: Rule, operation: RuleInput["operation"], dealType: string): boolean {
  if (rule.status !== "active") return false
  if (rule.scope.operations && !rule.scope.operations.includes(operation)) return false
  if (rule.scope.dealTypes && !rule.scope.dealTypes.includes(dealType)) return false
  return true
}

// Evaluates one rule. Pure: no I/O, no clock reads (evaluatedAt comes from
// the input bundle and is validated, never generated here... callers stamp
// input.evaluatedAt explicitly).
export function evaluateRule(rule: Rule, input: RuleInput): RuleResult {
  if (Number.isNaN(Date.parse(input.evaluatedAt))) {
    throw new Error("Rule evaluation needs an explicit valid evaluatedAt timestamp")
  }
  const evaluation = evaluateCondition(input, rule.condition)
  const fired =
    (evaluation.outcome === true && rule.fireOn) ||
    (evaluation.outcome === false && !rule.fireOn)

  if (evaluation.outcome === "unknown") {
    const paths = evaluation.unknownPaths.length > 0 ? evaluation.unknownPaths.slice(0, 3).join(", ") : "required inputs"
    return {
      ruleKey: rule.ruleKey,
      ruleVersion: `v${rule.version}`,
      status: "UNKNOWN",
      reason: `Cannot determine "${rule.title}": ${paths} unavailable.`,
      authority: rule.authority,
      evaluatedAt: input.evaluatedAt,
    }
  }
  if (fired) {
    return {
      ruleKey: rule.ruleKey,
      ruleVersion: `v${rule.version}`,
      status: "FAIL",
      finding: {
        ruleKey: rule.ruleKey,
        ruleVersion: rule.version,
        summary: rule.finding.summary,
        severity: rule.finding.severity,
        guidance: rule.finding.guidance,
        authority: rule.authority,
      },
      reason: `Rule "${rule.ruleKey}" v${rule.version} fired.`,
      authority: rule.authority,
      evaluatedAt: input.evaluatedAt,
    }
  }
  return {
    ruleKey: rule.ruleKey,
    ruleVersion: `v${rule.version}`,
    status: "PASS",
    reason: `Checked "${rule.title}": condition absent.`,
    authority: rule.authority,
    evaluatedAt: input.evaluatedAt,
  }
}

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  informational: 0,
  attention: 1,
  material: 2,
  critical: 3,
}

export interface FindingSelection {
  operation: RuleInput["operation"]
  intent?: RuleInput["intent"]
  objective?: RuleInput["objective"]
  limit?: number
}

// Deterministic finding selection for synthesis: FAIL findings first ordered
// by author-declared severity, then PASS notes are never included (PASS
// carries no finding). Intent and objective are retained as metadata for the
// synthesis layer to explain relevance; they cannot change any status here.
export function selectRelevantFindings(
  results: RuleResult[],
  selection: FindingSelection
): Array<Finding & { intent?: RuleInput["intent"]; objective?: RuleInput["objective"] }> {
  const fails = results.filter((r) => r.status === "FAIL" && r.finding)
  fails.sort((a, b) => {
    const bySeverity =
      SEVERITY_ORDER[b.finding!.severity] - SEVERITY_ORDER[a.finding!.severity]
    if (bySeverity !== 0) return bySeverity
    return a.ruleKey.localeCompare(b.ruleKey)
  })
  const limit = selection.limit ?? 10
  return fails.slice(0, Math.max(0, limit)).map((r) => ({
    ...r.finding!,
    intent: selection.intent,
    objective: selection.objective,
  }))
}

export interface ClaimedStatus {
  ruleKey: string
  assertedStatus: RuleResultStatus
}

// Detects conflicts between deterministic results and statuses an AI response
// claims. Returns human-readable conflict descriptions; empty means no
// conflict was detectable. Resolution UX belongs to a later phase.
export function detectFindingConflicts(results: RuleResult[], claims: ClaimedStatus[]): string[] {
  const byKey = new Map(results.map((r) => [r.ruleKey, r.status]))
  const conflicts: string[] = []
  for (const claim of claims) {
    const actual = byKey.get(claim.ruleKey)
    if (actual === undefined) {
      conflicts.push(`Claimed status for unknown rule "${claim.ruleKey}".`)
      continue
    }
    if (actual !== claim.assertedStatus) {
      conflicts.push(
        `Status conflict on "${claim.ruleKey}": deterministic ${actual}, asserted ${claim.assertedStatus}.`
      )
    }
  }
  return conflicts
}
