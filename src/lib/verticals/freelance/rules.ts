// Freelance vertical rule pack (Phase 5E).
//
// Nine deterministic rules over the freelance fact projection, all scoped to
// freelance/service deals and all declared as product policy: Dealenz product
// judgments about what deserves attention, never legal authority. Each rule
// has a clear predicate over facts.freelance.* paths; unknown facts keep
// their rule UNKNOWN (presence checks treat unobserved as missing, which the
// summaries state explicitly as "not found in the provided input").

import { registerRule } from "@/lib/rules/registry"
import type { Rule } from "@/lib/rules/schema"

const POLICY = "Dealenz product judgment about freelance deal hygiene, not legal authority."

function rule(partial: Omit<Rule, "status" | "version"> & { version?: number }): Rule {
  return { status: "active", version: 1, ...partial } as Rule
}

export const FREELANCE_RULES: Rule[] = [
  rule({
    ruleKey: "freelance-fee-terms-missing",
    title: "Freelance fee terms missing",
    description: "Fires when no fee or payment amount was observed in the deal input.",
    priority: 90,
    category: "absence",
    scope: { dealTypes: ["freelance"] },
    condition: { field: "facts.freelance.fee.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No fee or payment amount was found in the provided deal input.",
      severity: "attention",
      guidance: "Agree on the fee in writing before starting work.",
      pushback: "Please confirm the fee in writing before I start: the amount, what it covers, and when each payment is due.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "freelance-payment-timing-unclear",
    title: "Freelance payment timing unclear",
    description: "Fires when no payment timing terms were observed in the deal input.",
    priority: 85,
    category: "absence",
    scope: { dealTypes: ["freelance"] },
    condition: { field: "facts.freelance.paymentTiming.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No payment timing terms were found in the provided deal input.",
      severity: "attention",
      guidance: "Agree on when each payment is due, for example net 30 or on delivery.",
      pushback: "Please add payment timing. I propose 50 percent upfront and 50 percent on delivery.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "freelance-no-deposit",
    title: "Freelance deposit absent",
    description: "Fires when no upfront deposit or advance was observed in the deal input.",
    priority: 60,
    category: "absence",
    scope: { dealTypes: ["freelance"] },
    condition: { field: "facts.freelance.deposit.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No upfront deposit or advance was found in the provided deal input.",
      severity: "informational",
      guidance: "Consider asking for a deposit before starting, especially with new clients.",
      pushback: "Please add a deposit of 30 percent upfront before work begins, deductible from the final invoice.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "freelance-unlimited-revisions",
    title: "Freelance unlimited revisions",
    description: "Fires when the deal promises unlimited revisions or changes.",
    priority: 100,
    category: "presence",
    scope: { dealTypes: ["freelance"] },
    condition: { field: "facts.freelance.unlimitedRevisions.value", op: "eq", value: true },
    fireOn: true,
    finding: {
      summary: "The deal promises unlimited revisions.",
      severity: "material",
      guidance: "Cap revisions at a fixed number with a fee for extras.",
      pushback: "Please cap revisions at two rounds. Extra rounds will be billed at my standard rate.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "freelance-termination-missing",
    title: "Freelance termination term missing",
    description: "Fires when no termination or cancellation terms were observed.",
    priority: 80,
    category: "absence",
    scope: { dealTypes: ["freelance"] },
    condition: { field: "facts.freelance.termination.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No termination or cancellation terms were found in the provided deal input.",
      severity: "attention",
      guidance: "Agree on how either side can end the work and what gets paid then.",
      pushback: "Please add a termination term: either side may end with 14 days written notice, with completed work paid in full.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "freelance-ownership-unaddressed",
    title: "Freelance ownership unaddressed",
    description: "Fires when no ownership or IP transfer terms were observed.",
    priority: 75,
    category: "absence",
    scope: { dealTypes: ["freelance"] },
    condition: { field: "facts.freelance.ownership.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No ownership or IP transfer terms were found in the provided deal input.",
      severity: "attention",
      guidance: "State who owns the work and when ownership transfers, ideally on payment.",
      pushback: "Please confirm I transfer ownership of the deliverables once final payment clears.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "freelance-indemnity-present",
    title: "Freelance indemnity language present",
    description: "Fires when indemnity language was observed, so the user checks its direction.",
    priority: 65,
    category: "presence",
    scope: { dealTypes: ["freelance"] },
    condition: { field: "facts.freelance.indemnity.text", op: "exists" },
    fireOn: true,
    finding: {
      summary: "Indemnity language is present in the deal input.",
      severity: "attention",
      guidance: "Check who indemnifies whom, for what, and whether it is mutual.",
      pushback: "Please make the indemnity mutual and limited to third-party claims arising from the work.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "freelance-liability-uncapped",
    title: "Freelance liability uncapped",
    description: "Fires when liability language appears without any cap.",
    priority: 95,
    category: "consistency",
    scope: { dealTypes: ["freelance"] },
    condition: {
      all: [
        { field: "facts.freelance.liability.text", op: "exists" },
        { field: "facts.freelance.liabilityCap.text", op: "missing" },
      ],
    },
    fireOn: true,
    finding: {
      summary: "Liability language appears without any cap in the provided deal input.",
      severity: "material",
      guidance: "Cap liability at the fees paid under the agreement.",
      pushback: "Please cap my liability at the fees paid under this agreement.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "freelance-scope-vague",
    title: "Freelance scope vague",
    description: "Fires when no concrete deliverables were identified in the extraction.",
    priority: 70,
    category: "requirement",
    scope: { dealTypes: ["freelance"] },
    condition: { field: "facts.freelance.deliverablesCount", op: "eq", value: 0 },
    fireOn: true,
    finding: {
      summary: "No concrete deliverables were identified for this deal.",
      severity: "attention",
      guidance: "List exactly what will be delivered so scope stays measurable.",
      pushback: "Please list the exact deliverables in the agreement so scope stays measurable.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "freelance-conflicting-payment-terms",
    title: "Freelance conflicting payment terms",
    description: "Fires when structurally conflicting payment terms are preserved as separate observations.",
    priority: 98,
    category: "consistency",
    scope: { dealTypes: ["freelance"] },
    condition: { field: "facts.freelance.conflictingPaymentTerms.value", op: "eq", value: true },
    fireOn: true,
    finding: {
      summary: "Conflicting payment terms were found in the provided deal input.",
      severity: "material",
      guidance: "Clarify which payment terms apply: the input lists multiple conflicting values as separate observations. Confirm the correct schedule in writing before proceeding.",
      pushback: "The draft lists two different payment schedules. Please confirm which one applies and remove the other.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "freelance-conflicting-timeline",
    title: "Freelance conflicting timeline",
    description: "Fires when structurally conflicting timeline terms are preserved.",
    priority: 97,
    category: "consistency",
    scope: { dealTypes: ["freelance"] },
    condition: { field: "facts.freelance.conflictingTimelineTerms.value", op: "eq", value: true },
    fireOn: true,
    finding: {
      summary: "Conflicting timeline terms were found in the provided deal input.",
      severity: "material",
      guidance: "Clarify which timeline applies: multiple conflicting dates were observed as separate observations. Confirm the correct deadline in writing.",
      pushback: "The draft lists two different deadlines. Please confirm which date applies and remove the other.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
]

const registered = new Set<string>()

// Idempotent: safe to call at pipeline time and in tests.
export function registerFreelancePack(): Rule[] {
  const added: Rule[] = []
  for (const rule of FREELANCE_RULES) {
    const key = `${rule.ruleKey}@v${rule.version}`
    if (registered.has(key)) continue
    registered.add(key)
    try {
      added.push(registerRule(rule))
    } catch {
      // Already registered through another path; registry remains canonical.
    }
  }
  return added
}

export function resetFreelanceRegistration(): void {
  registered.clear()
}
