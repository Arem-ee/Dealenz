// Employment vertical rule pack (Phase 14).
//
// Deterministic rules over the employment fact projection, all scoped to
// employment and all product_policy: honest product judgments, never legal
// authority. Summaries state what was (not) found; guidance suggests what to
// clarify. No scores, no aggregation, never turns UNKNOWN into FAIL.

import { registerRule } from "@/lib/rules/registry"
import type { Rule } from "@/lib/rules/schema"

const POLICY = "Dealenz product judgment about employment deal hygiene, not legal authority."

function rule(partial: Omit<Rule, "status" | "version"> & { version?: number }): Rule {
  return { status: "active", version: 1, ...partial } as Rule
}

export const EMPLOYMENT_RULES: Rule[] = [
  rule({
    ruleKey: "employment-compensation-missing",
    title: "Employment compensation missing",
    description: "Fires when no compensation was observed.",
    priority: 95,
    category: "absence",
    scope: { dealTypes: ["employment"] },
    condition: { field: "facts.employment.compensation.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No compensation was found in the provided deal input.",
      severity: "attention",
      guidance: "Confirm the salary or wage, currency, and pay frequency.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "employment-role-missing",
    title: "Employment role missing",
    description: "Fires when the role or position was not observed.",
    priority: 90,
    category: "absence",
    scope: { dealTypes: ["employment"] },
    condition: { field: "facts.employment.role.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "The role or position was not clearly described in the provided deal input.",
      severity: "attention",
      guidance: "State the job title and reporting line.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "employment-commencement-missing",
    title: "Employment commencement missing",
    description: "Fires when no start or commencement date was observed.",
    priority: 85,
    category: "absence",
    scope: { dealTypes: ["employment"] },
    condition: { field: "facts.employment.commencement.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No commencement or start date was found in the provided deal input.",
      severity: "attention",
      guidance: "Agree on the start date and any conditions precedent.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "employment-term-missing",
    title: "Employment term missing",
    description: "Fires when no term or duration was observed.",
    priority: 80,
    category: "absence",
    scope: { dealTypes: ["employment"] },
    condition: { field: "facts.employment.termDuration.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No term or duration was found in the provided deal input.",
      severity: "informational",
      guidance: "Clarify whether the role is permanent or fixed term and its duration.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "employment-duties-missing",
    title: "Employment duties missing",
    description: "Fires when no duties or responsibilities were observed.",
    priority: 75,
    category: "absence",
    scope: { dealTypes: ["employment"] },
    condition: { field: "facts.employment.duties.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No duties or responsibilities were found in the provided deal input.",
      severity: "informational",
      guidance: "List the main duties so expectations are clear.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "employment-probation-missing",
    title: "Employment probation missing",
    description: "Fires when no probation or trial period was observed.",
    priority: 65,
    category: "absence",
    scope: { dealTypes: ["employment"] },
    condition: { field: "facts.employment.probation.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No probation or trial period was found in the provided deal input.",
      severity: "informational",
      guidance: "State whether a probation period applies and its length.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "employment-termination-missing",
    title: "Employment termination missing",
    description: "Fires when no termination terms were observed.",
    priority: 80,
    category: "absence",
    scope: { dealTypes: ["employment"] },
    condition: { field: "facts.employment.termination.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No termination terms were found in the provided deal input.",
      severity: "attention",
      guidance: "Clarify how either side can end the employment and what notice applies.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "employment-liability-uncapped",
    title: "Employment liability uncapped",
    description: "Fires when liability language appears without any cap.",
    priority: 95,
    category: "consistency",
    scope: { dealTypes: ["employment"] },
    condition: {
      all: [
        { field: "facts.employment.liability.text", op: "exists" },
        { field: "facts.employment.liabilityCap.text", op: "missing" },
      ],
    },
    fireOn: true,
    finding: {
      summary: "Liability language appears without any cap in the provided deal input.",
      severity: "material",
      guidance: "Ask for liability to be capped, for example at one month compensation.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
]

const registered = new Set<string>()

export function registerEmploymentPack(): Rule[] {
  const added: Rule[] = []
  for (const rule of EMPLOYMENT_RULES) {
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

export function resetEmploymentRegistration(): void {
  registered.clear()
}
