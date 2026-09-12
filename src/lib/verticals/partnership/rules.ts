// Partnership vertical rule pack (Phase 25).
//
// Deterministic rules over the partnership fact projection, all scoped to
// partnership and all product_policy: honest product judgments, never legal
// authority. Summaries state what was (not) found; guidance suggests what to
// clarify. No scores, no aggregation, never turns UNKNOWN into FAIL.

import { registerRule } from "@/lib/rules/registry"
import type { Rule } from "@/lib/rules/schema"

const POLICY = "Dealenz product judgment about partnership deal hygiene, not legal authority."

function rule(partial: Omit<Rule, "status" | "version"> & { version?: number }): Rule {
  return { status: "active", version: 1, ...partial } as Rule
}

export const PARTNERSHIP_RULES: Rule[] = [
  rule({
    ruleKey: "partnership-ownership-split-missing",
    title: "Partnership ownership split missing",
    description: "Fires when no ownership or profit split was observed.",
    priority: 90,
    category: "absence",
    scope: { dealTypes: ["partnership"] },
    condition: { field: "facts.partnership.ownershipSplit.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No ownership or profit split was found in the provided deal input.",
      severity: "attention",
      guidance: "Write down each partner's share of ownership, profit, and loss before anything else.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "partnership-contributions-missing",
    title: "Partnership contributions missing",
    description: "Fires when no partner contributions were observed.",
    priority: 85,
    category: "absence",
    scope: { dealTypes: ["partnership"] },
    condition: { field: "facts.partnership.contributions.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No partner contributions were found in the provided deal input.",
      severity: "attention",
      guidance: "Record what each partner puts in: cash, property, or services, and when.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "partnership-profit-distribution-missing",
    title: "Partnership profit distribution missing",
    description: "Fires when no profit distribution terms were observed.",
    priority: 80,
    category: "absence",
    scope: { dealTypes: ["partnership"] },
    condition: { field: "facts.partnership.profitDistribution.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No profit distribution terms were found in the provided deal input.",
      severity: "attention",
      guidance: "Agree on when and how profits are paid out, not just how they are split.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "partnership-authority-unclear",
    title: "Partnership management authority unclear",
    description: "Fires when no management authority terms were observed.",
    priority: 75,
    category: "absence",
    scope: { dealTypes: ["partnership"] },
    condition: { field: "facts.partnership.managementAuthority.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "Management authority was not clearly described in the provided deal input.",
      severity: "attention",
      guidance: "State who runs the business day to day and who can bind the partnership.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "partnership-governance-deadlock",
    title: "Partnership governance ambiguous",
    description: "Fires when neither governance nor decision-rights terms were observed.",
    priority: 70,
    category: "absence",
    scope: { dealTypes: ["partnership"] },
    condition: {
      any: [
        { field: "facts.partnership.governance.text", op: "missing" },
        { field: "facts.partnership.decisionRights.text", op: "missing" },
      ],
    },
    fireOn: true,
    finding: {
      summary: "Governance and decision rights were not clearly described in the provided deal input.",
      severity: "attention",
      guidance: "Agree on how votes work and how deadlocks get resolved before one happens.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "partnership-exit-missing",
    title: "Partnership exit provisions missing",
    description: "Fires when no exit, withdrawal, or buyout terms were observed.",
    priority: 65,
    category: "absence",
    scope: { dealTypes: ["partnership"] },
    condition: { field: "facts.partnership.exitBuyout.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No exit or buyout terms were found in the provided deal input.",
      severity: "informational",
      guidance: "Consider how a partner leaves and how their interest is valued.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "partnership-transfer-restriction-ambiguous",
    title: "Partnership transfer restrictions ambiguous",
    description: "Fires when no partnership interest transfer restrictions were observed.",
    priority: 60,
    category: "absence",
    scope: { dealTypes: ["partnership"] },
    condition: { field: "facts.partnership.transferRestrictions.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No partnership interest transfer restrictions were found in the provided deal input.",
      severity: "informational",
      guidance: "Consider whether selling an interest needs the other partners' consent.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "partnership-liability-uncapped",
    title: "Partnership liability uncapped",
    description: "Fires when liability language appears without any cap.",
    priority: 95,
    category: "consistency",
    scope: { dealTypes: ["partnership"] },
    condition: {
      all: [
        { field: "facts.partnership.liability.text", op: "exists" },
        { field: "facts.partnership.liabilityCap.text", op: "missing" },
      ],
    },
    fireOn: true,
    finding: {
      summary: "Liability language appears without any cap in the provided deal input.",
      severity: "material",
      guidance: "Ask for liability to be capped, for example at contributed capital.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
]

const registered = new Set<string>()

export function registerPartnershipPack(): Rule[] {
  const added: Rule[] = []
  for (const rule of PARTNERSHIP_RULES) {
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

export function resetPartnershipRegistration(): void {
  registered.clear()
}
