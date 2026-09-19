// Founder vertical rule pack (Phase 22).
//
// Deterministic rules over the founder fact projection, all scoped to
// founder and all product_policy: honest product judgments, never legal
// authority. Summaries state what was (not) found; guidance suggests what to
// clarify. No scores, no aggregation, never turns UNKNOWN into FAIL.

import { registerRule } from "@/lib/rules/registry"
import type { Rule } from "@/lib/rules/schema"

const POLICY = "Dealenz product judgment about founder deal hygiene, not legal authority."

function rule(partial: Omit<Rule, "status" | "version"> & { version?: number }): Rule {
  return { status: "active", version: 1, ...partial } as Rule
}

export const FOUNDER_RULES: Rule[] = [
  rule({
    ruleKey: "founder-ownership-split-missing",
    title: "Founder ownership split missing",
    description: "Fires when no ownership or equity split was observed.",
    priority: 90,
    category: "absence",
    scope: { dealTypes: ["founder"] },
    condition: { field: "facts.founder.ownershipSplit.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No ownership or equity split was found in the provided deal input.",
      severity: "attention",
      guidance: "Write down each founder's percentage before anything else.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "founder-vesting-missing",
    title: "Founder vesting missing",
    description: "Fires when no vesting, cliff, or acceleration terms were observed.",
    priority: 85,
    category: "absence",
    scope: { dealTypes: ["founder"] },
    condition: { field: "facts.founder.vesting.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No vesting terms were found in the provided deal input.",
      severity: "attention",
      guidance: "Agree on a vesting schedule, cliff, and what happens on exit.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "founder-ip-assignment-missing",
    title: "Founder IP assignment missing",
    description: "Fires when no IP assignment terms were observed.",
    priority: 80,
    category: "absence",
    scope: { dealTypes: ["founder"] },
    condition: { field: "facts.founder.ipAssignment.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No IP assignment terms were found in the provided deal input.",
      severity: "attention",
      guidance: "Confirm that work created by founders belongs to the company.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "founder-roles-unclear",
    title: "Founder roles unclear",
    description: "Fires when founder roles or titles were not observed.",
    priority: 75,
    category: "absence",
    scope: { dealTypes: ["founder"] },
    condition: { field: "facts.founder.founderRoles.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "Founder roles or titles were not clearly described in the provided deal input.",
      severity: "attention",
      guidance: "State who does what and who decides what.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "founder-governance-deadlock",
    title: "Founder governance ambiguous",
    description: "Fires when neither governance nor decision-rights terms were observed.",
    priority: 70,
    category: "absence",
    scope: { dealTypes: ["founder"] },
    condition: {
      any: [
        { field: "facts.founder.governance.text", op: "missing" },
        { field: "facts.founder.decisionRights.text", op: "missing" },
      ],
    },
    fireOn: true,
    finding: {
      summary: "Governance and decision rights were not clearly described in the provided deal input.",
      severity: "attention",
      guidance: "Agree on how deadlocks get resolved before one happens.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "founder-leaver-missing",
    title: "Founder leaver provisions missing",
    description: "Fires when no leaver, departure, or exit terms were observed.",
    priority: 65,
    category: "absence",
    scope: { dealTypes: ["founder"] },
    condition: { field: "facts.founder.leaverProvisions.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No leaver or departure terms were found in the provided deal input.",
      severity: "informational",
      guidance: "Consider what happens to shares when a founder leaves.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "founder-transfer-restriction-ambiguous",
    title: "Founder transfer restrictions ambiguous",
    description: "Fires when no share transfer restrictions were observed.",
    priority: 60,
    category: "absence",
    scope: { dealTypes: ["founder"] },
    condition: { field: "facts.founder.transferRestrictions.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No share transfer restrictions were found in the provided deal input.",
      severity: "informational",
      guidance: "Consider whether share sales need the other founders' consent.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "founder-liability-uncapped",
    title: "Founder liability uncapped",
    description: "Fires when liability language appears without any cap.",
    priority: 95,
    category: "consistency",
    scope: { dealTypes: ["founder"] },
    condition: {
      all: [
        { field: "facts.founder.liability.text", op: "exists" },
        { field: "facts.founder.liabilityCap.text", op: "missing" },
      ],
    },
    fireOn: true,
    finding: {
      summary: "Liability language appears without any cap in the provided deal input.",
      severity: "material",
      guidance: "Ask for liability to be capped, for example at invested capital.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "founder-conflicting-payment-terms",
    title: "Founder conflicting payment terms",
    description: "Fires when structurally conflicting payment terms are preserved as separate observations.",
    priority: 98,
    category: "consistency",
    scope: { dealTypes: ["founder"] },
    condition: { field: "facts.founder.conflictingPaymentTerms.value", op: "eq", value: true },
    fireOn: true,
    finding: {
      summary: "Conflicting payment terms were found in the provided deal input.",
      severity: "material",
      guidance: "Clarify which payment terms apply: the input lists multiple conflicting values as separate observations. Confirm the correct schedule in writing before proceeding.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "founder-conflicting-timeline",
    title: "Founder conflicting timeline",
    description: "Fires when structurally conflicting timeline terms are preserved.",
    priority: 97,
    category: "consistency",
    scope: { dealTypes: ["founder"] },
    condition: { field: "facts.founder.conflictingTimelineTerms.value", op: "eq", value: true },
    fireOn: true,
    finding: {
      summary: "Conflicting timeline terms were found in the provided deal input.",
      severity: "material",
      guidance: "Clarify which timeline applies: multiple conflicting dates were observed as separate observations. Confirm the correct dates in writing.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
]

const registered = new Set<string>()

export function registerFounderPack(): Rule[] {
  const added: Rule[] = []
  for (const rule of FOUNDER_RULES) {
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

export function resetFounderRegistration(): void {
  registered.clear()
}
