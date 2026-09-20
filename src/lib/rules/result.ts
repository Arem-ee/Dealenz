// Rule results and findings (Phase 5D).
//
// A RuleResult is an internal authority object: what fired, why, under which
// authority, and when. It is never user-facing prose. Findings state facts
// ("Payment term is missing."); AI synthesis may later explain them ("I would
// clarify the payment date..."). The two must never be mixed, and synthesis
// must never silently flip a deterministic status (see detectFindingConflicts).

import { evaluateCondition } from "./evaluator"
import type { Evidence } from "@/lib/evidence/schema"
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
  pushback?: string
  authority: RuleAuthority
  // Supporting evidence references, attached post-evaluation by
  // attachEvidence (src/lib/evidence/collect.ts). Absent means none was
  // found — never fabricated to fill the field.
  evidence?: Evidence[]
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
        pushback: rule.finding.pushback,
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

export interface DeterministicRiskFloor {
  // Display bucket derived from the worst deterministic FAIL severity.
  // Health-score polarity (matches prompts.ts and ScoreGauge): lower numeric
  // means higher risk. Placeholders are bucket-derived, never computed scores.
  level: "Low" | "Medium" | "High"
  score: number
  severity: "low" | "medium" | "high"
}

// Deterministic risk floor (Phase 21 authority boundary).
//
// Maps evaluated rule results to the minimum risk the UI may display: any
// critical/material FAIL floors at High (20), otherwise any attention FAIL
// floors at Medium (50), otherwise Low (80). Only FAIL findings count —
// PASS, UNKNOWN, and informational-only FAILs never raise the floor, and
// UNKNOWN is never converted into a failure. Pure: same results in,
// same floor out. Callers use this to ensure AI advisory scores cannot
// silently hide a deterministic failure; AI text (summary, themes,
// recommendations) is preserved separately.
export function deterministicRiskFloor(results: RuleResult[]): DeterministicRiskFloor {
  const fails = results.filter((r) => r.status === "FAIL" && r.finding)
  if (fails.some((f) => f.finding!.severity === "critical" || f.finding!.severity === "material")) {
    return { level: "High", score: 20, severity: "high" }
  }
  if (fails.some((f) => f.finding!.severity === "attention")) {
    return { level: "Medium", score: 50, severity: "medium" }
  }
  return { level: "Low", score: 80, severity: "low" }
}

const RISK_LEVEL_RANK: Record<DeterministicRiskFloor["level"], number> = {
  Low: 0,
  Medium: 1,
  High: 2,
}

// Returns true when the floor demands at least as much risk as the given
// displayed level — i.e. the display must be raised to the floor.
export function floorExceedsDisplay(
  floor: DeterministicRiskFloor["level"],
  displayed: string
): boolean {
  const rank = (level: string): number => {
    const l = level.toLowerCase()
    if (l === "critical" || l === "high") return 2
    if (l === "medium") return 1
    return 0
  }
  return RISK_LEVEL_RANK[floor] > rank(displayed)
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

export interface FindingDeltaEntry {
  ruleKey: string
  summary: string
  severity: FindingSeverity
}

export interface FindingDelta {
  // Was FAIL, now PASS/absent: the redline plausibly addressed it. Deterministic
  // comparison only — it cannot prove the new language is safe, only that the
  // flagged condition no longer fires.
  resolved: FindingDeltaEntry[]
  // FAIL in both runs: still open.
  stillOpen: FindingDeltaEntry[]
  // FAIL now, not FAIL before: newly surfaced by the revised input.
  newIssues: FindingDeltaEntry[]
}

// Diffs two FAIL sets by ruleKey for redline re-checks: run N+1 against the
// persisted findings of run N. Pure and defensive: persisted rows predate any
// schema, so anything without a string ruleKey is ignored, and non-FAIL rows
// never enter the comparison. Returns null when there is no previous FAIL
// baseline (first analysis) — no baseline, no delta.
export function diffFindingSets(previous: unknown, current: RuleResult[]): FindingDelta | null {
  const prevFails = new Map<string, FindingDeltaEntry>()
  if (Array.isArray(previous)) {
    for (const row of previous) {
      if (typeof row !== "object" || row === null) continue
      const r = row as { ruleKey?: unknown; status?: unknown; finding?: { summary?: unknown; severity?: unknown } }
      if (typeof r.ruleKey !== "string" || r.ruleKey.length === 0) continue
      if (r.status !== "FAIL" || typeof r.finding !== "object" || r.finding === null) continue
      const severity = r.finding.severity
      if (severity !== "informational" && severity !== "attention" && severity !== "material" && severity !== "critical") continue
      prevFails.set(r.ruleKey, {
        ruleKey: r.ruleKey,
        summary: typeof r.finding.summary === "string" ? r.finding.summary : r.ruleKey,
        severity,
      })
    }
  }
  if (prevFails.size === 0) return null
  const curFails = new Map<string, FindingDeltaEntry>()
  for (const r of current) {
    if (r.status !== "FAIL" || !r.finding) continue
    curFails.set(r.ruleKey, { ruleKey: r.ruleKey, summary: r.finding.summary, severity: r.finding.severity })
  }
  const resolved: FindingDeltaEntry[] = []
  const stillOpen: FindingDeltaEntry[] = []
  for (const [key, entry] of prevFails) {
    const now = curFails.get(key)
    if (now) stillOpen.push(now)
    else resolved.push(entry)
  }
  const newIssues: FindingDeltaEntry[] = []
  for (const [key, entry] of curFails) {
    if (!prevFails.has(key)) newIssues.push(entry)
  }
  return { resolved, stillOpen, newIssues }
}

// One-line human account of a re-check. Counts only — the workspace renders
// the itemized lists from the persisted delta.
export function describeFindingDelta(delta: FindingDelta): string {
  const parts = [
    `${delta.resolved.length} resolved`,
    `${delta.stillOpen.length} still open`,
    `${delta.newIssues.length} new`,
  ]
  return `Re-check complete: ${parts.join(", ")}.`
}

// Thread message for a completed analysis. Re-checks announce their verdict;
// first analyses keep the established message. Pure: both posting paths
// (executor insert, analyzeAndPostRisk) share it so the wording cannot drift.
// A malformed delta falls back to the first-analysis message — posting must
// never break on data shape.
export function analysisThreadMessage(input: {
  riskLevel?: string | null
  findingsCount?: number | null
  findingDelta?: FindingDelta | null
}): string {
  const d = input.findingDelta as unknown
  if (
    d &&
    typeof d === "object" &&
    Array.isArray((d as FindingDelta).resolved) &&
    Array.isArray((d as FindingDelta).stillOpen) &&
    Array.isArray((d as FindingDelta).newIssues)
  ) {
    return describeFindingDelta(d as FindingDelta)
  }
  const count = typeof input.findingsCount === "number" ? ` (${input.findingsCount} findings)` : ""
  return `Risk analysis complete: ${input.riskLevel ?? "Unknown"}${count}`
}
