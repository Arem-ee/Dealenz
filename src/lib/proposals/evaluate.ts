import type { ProposalPlan } from "./plan"
import type { RuleResult } from "@/lib/rules/result"

function result(ruleKey: string, status: RuleResult["status"], reason: string, findingSummary?: string): RuleResult {
  const base = {
    ruleKey,
    ruleVersion: "v1",
    status,
    reason,
    authority: { kind: "product_policy" as const, note: "Proposal standard" },
    evaluatedAt: new Date().toISOString(),
  }
  if (status === "FAIL" && findingSummary) {
    return {
      ...base,
      finding: {
        ruleKey,
        ruleVersion: 1,
        summary: findingSummary,
        severity: "material" as const,
        authority: base.authority,
      },
    }
  }
  return base as RuleResult
}

const BANNED_GUARANTEE = /\b(guarantee[ds]?|world-class|best-in-class|revolutionary|cutting-edge|transformative|#1|number one)\b/i

export interface ProposalEvaluation {
  results: RuleResult[]
  gaps: string[]
  hasFail: boolean
  hasUnknown: boolean
}

export function evaluateProposal(plan: ProposalPlan, proposalText: string): ProposalEvaluation {
  const results: RuleResult[] = []
  const text = proposalText || ""
  const lower = text.toLowerCase()

  const has = (needle: string) => lower.includes(needle.toLowerCase())

  if (plan.objectives.length > 0) {
    const missing = plan.objectives.filter((o) => !has(o.text.slice(0, 20)))
    if (missing.length > 0) {
      results.push(result("proposal-objective-coverage", "FAIL", `Missing response for: ${missing[0].text.slice(0, 40)}`, "Objective without response"))
    } else {
      results.push(result("proposal-objective-coverage", "PASS", "All objectives have response"))
    }
  } else {
    results.push(result("proposal-objective-coverage", "UNKNOWN", "No objectives to verify"))
  }

  if (plan.deliverables.length > 0) {
    const withoutRationale = plan.deliverables.filter((d) => !d.whyItMatters)
    const textMissingRationale = withoutRationale.length > 0 && !lower.includes("why") && !lower.includes("because") && !lower.includes("so that")
    if (withoutRationale.length > 0 && textMissingRationale) {
      results.push(result("proposal-deliverable-rationale", "FAIL", "Deliverable without rationale", "Deliverable without rationale"))
    } else {
      results.push(result("proposal-deliverable-rationale", "PASS", "Deliverables have rationale"))
    }
  } else {
    results.push(result("proposal-deliverable-rationale", "UNKNOWN", "No deliverables to check"))
  }

  const hasNextStep = plan.nextStep !== null && has(plan.nextStep.slice(0, 15)) || has("next step") || has("next steps")
  if (!hasNextStep) {
    results.push(result("proposal-next-step", "FAIL", "Missing next step", "Missing next step"))
  } else {
    results.push(result("proposal-next-step", "PASS", "Next step present"))
  }

  if (plan.unresolved.length > 0 && plan.assumptions.length === 0) {
    results.push(result("proposal-assumptions-visible", "FAIL", "Unresolved items not surfaced as assumptions", "Unresolved not surfaced"))
  } else if (plan.unresolved.length > 0) {
    results.push(result("proposal-assumptions-visible", "PASS", "Assumptions visible"))
  } else {
    results.push(result("proposal-assumptions-visible", "PASS", "No unresolved to surface"))
  }

  if (BANNED_GUARANTEE.test(text)) {
    const hasGrounded = plan.benefits.some((b) => b.isGuarantee)
    if (!hasGrounded) {
      results.push(result("proposal-no-guarantee", "FAIL", "Unsupported guarantee language", "Unsupported guarantee"))
    } else {
      results.push(result("proposal-no-guarantee", "PASS", "Guarantee supported"))
    }
  } else {
    results.push(result("proposal-no-guarantee", "PASS", "No unsupported guarantee"))
  }

  const timeline = plan.commercial.timeline
  const scopeCount = plan.deliverables.length
  if (timeline && scopeCount > 5 && /week|day/i.test(timeline) && !has("phase") && !has("milestone")) {
    results.push(result("proposal-commercial-consistency", "FAIL", "Commercial inconsistency", "Commercial inconsistency"))
  } else {
    results.push(result("proposal-commercial-consistency", "PASS", "Commercial consistent"))
  }

  if (plan.unresolved.length > 2) {
    results.push(result("proposal-unresolved", "UNKNOWN", `Unresolved: ${plan.unresolved.slice(0, 2).join(", ")}`))
  }

  const requiredMissing = plan.requiredSections.filter((s) => !has(s))
  if (requiredMissing.length > 0) {
    results.push(result("proposal-required-sections", "FAIL", `Missing sections: ${requiredMissing.slice(0, 2).join(", ")}`, "Missing required sections"))
  } else {
    results.push(result("proposal-required-sections", "PASS", "Required sections present"))
  }

  const gaps = results.filter((r) => r.status === "FAIL" || r.status === "UNKNOWN").map((r) => r.reason)
  return { results, gaps, hasFail: results.some((r) => r.status === "FAIL"), hasUnknown: results.some((r) => r.status === "UNKNOWN") }
}
