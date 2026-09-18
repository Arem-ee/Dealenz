// Generic vertical rule pack — lightweight deterministic floor for any contract.
// Exactly 7 rules, all product_policy, scoped to generic, no LLM, no network.

import { registerRule } from "@/lib/rules/registry"
import { deterministicRiskFloor } from "@/lib/rules/result"
import type { Rule } from "@/lib/rules/schema"
import type { RuleResult } from "@/lib/rules/result"

const POLICY = "Dealenz product judgment about universal contract completeness, not legal authority."

function rule(partial: Omit<Rule, "status" | "version"> & { version?: number }): Rule {
  return { status: "active", version: 1, ...partial } as Rule
}

export const GENERIC_RULES: Rule[] = [
  rule({
    ruleKey: "generic-termination-missing",
    title: "Generic termination clause missing",
    description: "Fires when no termination or cancellation clause was observed.",
    priority: 80,
    category: "absence",
    scope: { dealTypes: ["generic"] },
    condition: { field: "facts.generic.termination.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No termination or cancellation clause was found in the provided deal input.",
      severity: "attention",
      guidance: "Add how either side can end the agreement and what happens then.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "generic-governing-law-missing",
    title: "Generic governing law missing",
    description: "Fires when no governing law or jurisdiction was stated.",
    priority: 75,
    category: "absence",
    scope: { dealTypes: ["generic"] },
    condition: { field: "facts.generic.governingLaw.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No governing law or jurisdiction was found in the provided deal input.",
      severity: "attention",
      guidance: "State which law governs and where disputes are handled.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "generic-payment-terms-missing",
    title: "Generic payment terms missing",
    description: "Fires when no payment or consideration terms were observed.",
    priority: 85,
    category: "absence",
    scope: { dealTypes: ["generic"] },
    condition: { field: "facts.generic.paymentTerms.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No payment or consideration terms were found in the provided deal input.",
      severity: "attention",
      guidance: "Define the amount, currency, and when it is due.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "generic-liability-uncapped",
    title: "Generic liability uncapped",
    description: "Fires when liability language appears without any cap.",
    priority: 95,
    category: "consistency",
    scope: { dealTypes: ["generic"] },
    condition: {
      all: [
        { field: "facts.generic.liability.text", op: "exists" },
        { field: "facts.generic.liabilityCap.text", op: "missing" },
      ],
    },
    fireOn: true,
    finding: {
      summary: "Liability language appears without any cap in the provided deal input.",
      severity: "material",
      guidance: "Consider capping liability at the fees paid.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "generic-dispute-resolution-missing",
    title: "Generic dispute resolution missing",
    description: "Fires when no dispute resolution mechanism was observed.",
    priority: 70,
    category: "absence",
    scope: { dealTypes: ["generic"] },
    condition: { field: "facts.generic.disputeResolution.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No dispute resolution mechanism was found in the provided deal input.",
      severity: "attention",
      guidance: "Add how disputes will be resolved, for example mediation or arbitration.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "generic-scope-ambiguous",
    title: "Generic scope ambiguous",
    description: "Fires when no concrete scope or deliverables were identified.",
    priority: 77,
    category: "absence",
    scope: { dealTypes: ["generic"] },
    condition: {
      any: [
        { field: "facts.generic.scope.text", op: "missing" },
        { field: "facts.generic.deliverablesCount", op: "eq", value: 0 },
      ],
    },
    fireOn: true,
    finding: {
      summary: "No clear scope or deliverables were identified for this deal.",
      severity: "attention",
      guidance: "List exactly what will be delivered so scope stays measurable.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "generic-amendment-one-sided",
    title: "Generic one-sided amendment",
    description: "Fires when one-sided amendment language was observed.",
    priority: 65,
    category: "presence",
    scope: { dealTypes: ["generic"] },
    condition: { field: "facts.generic.amendment.text", op: "exists" },
    fireOn: true,
    finding: {
      summary: "One-sided amendment language is present in the deal input.",
      severity: "attention",
      guidance: "Check whether changes require mutual written agreement.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "generic-conflicting-payment-terms",
    title: "Generic conflicting payment terms",
    description: "Fires when payment terms contain conflicting values separated by '; '.",
    priority: 98,
    category: "consistency",
    scope: { dealTypes: ["generic"] },
    condition: { field: "facts.generic.paymentTerms.text", op: "contains", value: ";" },
    fireOn: true,
    finding: {
      summary: "Conflicting payment terms were found in the provided deal input.",
      severity: "material",
      guidance: "Clarify which payment terms apply — the input lists multiple conflicting values separated by '; '. Confirm the correct terms in writing.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "generic-conflicting-scope",
    title: "Generic conflicting scope",
    description: "Fires when scope contains conflicting deliverables separated by '; '.",
    priority: 97,
    category: "consistency",
    scope: { dealTypes: ["generic"] },
    condition: { field: "facts.generic.scope.text", op: "contains", value: ";" },
    fireOn: true,
    finding: {
      summary: "Conflicting scope terms were found in the provided deal input.",
      severity: "material",
      guidance: "Clarify which scope applies — multiple conflicting deliverables are listed separated by '; '. Confirm the correct scope in writing.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
]

// Bucket mapping for deterministic generic scoring (AI-authority fix).
// Delegates to the shared deterministic floor (Phase 21) so every vertical
// maps severity to buckets identically; the legacy bucket/severity names
// ("moderate" vs "medium") are preserved for backward compatibility.
// Numeric placeholders are bucket-derived, not computed scores.
export function bucketForGenericFindings(results: RuleResult[]): {
  bucket: "high" | "moderate" | "low"
  score: number
  level: "High" | "Medium" | "Low"
  severity: "high" | "moderate" | "low"
} {
  const floor = deterministicRiskFloor(results)
  if (floor.level === "High") return { bucket: "high", score: 20, level: "High", severity: "high" }
  if (floor.level === "Medium") return { bucket: "moderate", score: 50, level: "Medium", severity: "moderate" }
  return { bucket: "low", score: 80, level: "Low", severity: "low" }
}

const registered = new Set<string>()

export function registerGenericPack(): Rule[] {
  const added: Rule[] = []
  for (const rule of GENERIC_RULES) {
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

export function resetGenericRegistration(): void {
  registered.clear()
}
