// State machines for work execution (Phase 23C).
//
// Deterministic, pure, no LLM. Reuses review/transitions.ts pattern.
// Human gates are explicit states, not silent continuations.

import type { PlanStatus, StepStatus, ExecutionStatus } from "./schema"

export const planTransition = {
  can(from: PlanStatus, to: PlanStatus): boolean {
    const allowed: Record<PlanStatus, PlanStatus[]> = {
      draft: ["awaiting_approval", "canceled"],
      awaiting_approval: ["approved", "canceled", "draft"],
      approved: ["executing", "canceled"],
      executing: ["done", "failed", "canceled", "needs_input", "rate_limited"],
      needs_input: ["executing", "failed", "canceled", "draft"],
      rate_limited: ["executing", "failed", "canceled", "draft"],
      done: [],
      failed: ["draft", "canceled"],
      canceled: [],
    }
    return allowed[from]?.includes(to) ?? false
  },
  assert(from: PlanStatus, to: PlanStatus) {
    if (!planTransition.can(from, to)) throw new Error(`Invalid plan transition ${from} → ${to}`)
  },
}

export const stepTransition = {
  can(from: StepStatus, to: StepStatus): boolean {
    const allowed: Record<StepStatus, StepStatus[]> = {
      pending: ["ready", "blocked", "skipped"],
      ready: ["running", "blocked", "skipped"],
      running: ["succeeded", "failed", "needs_input", "rate_limited", "blocked"],
      succeeded: [],
      failed: ["pending", "skipped"],
      needs_input: ["pending", "skipped", "failed"],
      rate_limited: ["pending", "skipped", "failed"],
      blocked: ["pending", "ready", "skipped"],
      skipped: [],
    }
    return allowed[from]?.includes(to) ?? false
  },
  assert(from: StepStatus, to: StepStatus) {
    if (!stepTransition.can(from, to)) throw new Error(`Invalid step transition ${from} → ${to}`)
  },
}

export const executionTransition = {
  can(from: ExecutionStatus, to: ExecutionStatus): boolean {
    const allowed: Record<ExecutionStatus, ExecutionStatus[]> = {
      pending: ["running", "canceled", "needs_approval"],
      running: ["succeeded", "failed", "canceled", "needs_input", "needs_approval", "rate_limited"],
      needs_input: ["running", "failed", "canceled"],
      needs_approval: ["running", "failed", "canceled"],
      rate_limited: ["running", "failed", "canceled"],
      succeeded: [],
      failed: [],
      canceled: [],
    }
    return allowed[from]?.includes(to) ?? false
  },
  assert(from: ExecutionStatus, to: ExecutionStatus) {
    if (!executionTransition.can(from, to)) throw new Error(`Invalid execution transition ${from} → ${to}`)
  },
}

// Dependency check: a step is executable when all dependsOn steps are succeeded (or skipped where allowed)
export function isStepReady(step: { dependsOn: string[]; status: StepStatus }, deps: Map<string, StepStatus>): boolean {
  if (step.status !== "pending" && step.status !== "blocked" && step.status !== "ready") return false
  for (const depId of step.dependsOn) {
    const depStatus = deps.get(depId)
    if (depStatus !== "succeeded" && depStatus !== "skipped") return false
  }
  return true
}

// A plan can be approved only from awaiting_approval
export function canApprovePlan(status: PlanStatus): boolean {
  return status === "awaiting_approval"
}

// A plan payload change invalidates prior approval: version or hash mismatch → not approved
export function isApprovalValidForPlan(approval: { plan_version: number; approved_payload_hash: string }, plan: { version: number; payload_hash: string }): boolean {
  return approval.plan_version === plan.version && approval.approved_payload_hash === plan.payload_hash
}
