// Lease vertical rule pack (Phase 6).
//
// Nine deterministic rules over the lease fact projection, all scoped to
// lease deals and all declared as product policy: Dealenz product judgments
// about commercially meaningful omissions or unusual terms, never legal
// authority and never legal certainty. Summaries state what was (not) found
// in the provided input; guidance suggests what to clarify or negotiate.

import { registerRule } from "@/lib/rules/registry"
import type { Rule } from "@/lib/rules/schema"

const POLICY = "Dealenz product judgment about lease deal hygiene, not legal authority."

function rule(partial: Omit<Rule, "status" | "version"> & { version?: number }): Rule {
  return { status: "active", version: 1, ...partial } as Rule
}

export const LEASE_RULES: Rule[] = [
  rule({
    ruleKey: "lease-rent-terms-missing",
    title: "Lease rent terms missing",
    description: "Fires when no rent or payment amount was observed in the deal input.",
    priority: 90,
    category: "absence",
    scope: { dealTypes: ["lease"] },
    condition: { field: "facts.lease.rent.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No rent or payment amount was found in the provided deal input.",
      severity: "attention",
      guidance: "Confirm the rent amount, what it covers, and when it is due.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "lease-term-missing",
    title: "Lease term missing",
    description: "Fires when no lease length or fixed term was observed.",
    priority: 88,
    category: "absence",
    scope: { dealTypes: ["lease"] },
    condition: { field: "facts.lease.leaseTerm.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No lease length or fixed term was found in the provided deal input.",
      severity: "attention",
      guidance: "Confirm how long the lease runs and when it ends.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "lease-termination-notice-missing",
    title: "Lease termination and notice missing",
    description: "Fires when neither termination terms nor notice terms were observed.",
    priority: 85,
    category: "absence",
    scope: { dealTypes: ["lease"] },
    condition: {
      all: [
        { field: "facts.lease.termination.text", op: "missing" },
        { field: "facts.lease.notice.text", op: "missing" },
      ],
    },
    fireOn: true,
    finding: {
      summary: "No termination or notice terms were found in the provided deal input.",
      severity: "attention",
      guidance: "Check how either side can end the lease early and what notice is required.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "lease-deposit-missing",
    title: "Lease deposit missing",
    description: "Fires when no deposit or security deposit was observed.",
    priority: 60,
    category: "absence",
    scope: { dealTypes: ["lease"] },
    condition: { field: "facts.lease.deposit.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No deposit or security deposit was found in the provided deal input.",
      severity: "informational",
      guidance: "Confirm whether a deposit is required and when it is returned.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "lease-maintenance-unclear",
    title: "Lease maintenance responsibility unclear",
    description: "Fires when neither maintenance nor repair responsibility was observed.",
    priority: 80,
    category: "absence",
    scope: { dealTypes: ["lease"] },
    condition: {
      all: [
        { field: "facts.lease.maintenance.text", op: "missing" },
        { field: "facts.lease.repairs.text", op: "missing" },
      ],
    },
    fireOn: true,
    finding: {
      summary: "Maintenance and repair responsibility is not addressed in the provided deal input.",
      severity: "attention",
      guidance: "Clarify who maintains the property and who pays for repairs.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "lease-rent-review-unclear",
    title: "Lease rent review unclear",
    description: "Fires when no rent review or increase mechanism was observed.",
    priority: 65,
    category: "absence",
    scope: { dealTypes: ["lease"] },
    condition: { field: "facts.lease.rentReview.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No rent review or increase mechanism was found in the provided deal input.",
      severity: "informational",
      guidance: "Ask how and when the rent can change during the term.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "lease-subletting-terms-present",
    title: "Lease subletting terms present",
    description: "Fires when subletting or assignment language was observed, so consent terms get checked.",
    priority: 70,
    category: "presence",
    scope: { dealTypes: ["lease"] },
    condition: { field: "facts.lease.subletting.text", op: "exists" },
    fireOn: true,
    finding: {
      summary: "Subletting or assignment language appears in the provided deal input.",
      severity: "attention",
      guidance: "Check whether subletting needs consent and on what terms it can be refused.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "lease-liability-uncapped",
    title: "Lease liability uncapped",
    description: "Fires when liability language appears without any cap.",
    priority: 95,
    category: "consistency",
    scope: { dealTypes: ["lease"] },
    condition: {
      all: [
        { field: "facts.lease.liability.text", op: "exists" },
        { field: "facts.lease.liabilityCap.text", op: "missing" },
      ],
    },
    fireOn: true,
    finding: {
      summary: "Liability language appears without any cap in the provided deal input.",
      severity: "material",
      guidance: "Ask for liability to be capped, for example at rent paid over a defined period.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "lease-permitted-use-unclear",
    title: "Lease permitted use unclear",
    description: "Fires when no permitted-use terms were observed.",
    priority: 62,
    category: "absence",
    scope: { dealTypes: ["lease"] },
    condition: { field: "facts.lease.permittedUse.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No permitted-use terms were found in the provided deal input.",
      severity: "informational",
      guidance: "Confirm what the property may be used for before signing.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
]

const registered = new Set<string>()

// Idempotent: safe to call at pipeline time and in tests without collisions.
export function registerLeasePack(): Rule[] {
  const added: Rule[] = []
  for (const rule of LEASE_RULES) {
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

export function resetLeaseRegistration(): void {
  registered.clear()
}
