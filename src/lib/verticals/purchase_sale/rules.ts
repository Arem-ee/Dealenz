// Purchase/Sale vertical rule pack (Phase 13).
//
// Deterministic rules over the purchase/sale fact projection, all scoped to
// purchase_sale and all product_policy: honest product judgments, never legal
// authority. Summaries state what was (not) found; guidance suggests what to
// clarify. No scores, no aggregation, never turns UNKNOWN into FAIL.

import { registerRule } from "@/lib/rules/registry"
import type { Rule } from "@/lib/rules/schema"

const POLICY = "Dealenz product judgment about purchase/sale deal hygiene, not legal authority."

function rule(partial: Omit<Rule, "status" | "version"> & { version?: number }): Rule {
  return { status: "active", version: 1, ...partial } as Rule
}

export const PURCHASE_SALE_RULES: Rule[] = [
  rule({
    ruleKey: "purchase-price-missing",
    title: "Purchase price missing",
    description: "Fires when no purchase/sale price was observed.",
    priority: 95,
    category: "absence",
    scope: { dealTypes: ["purchase_sale"] },
    condition: { field: "facts.purchase_sale.purchasePrice.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No purchase price was found in the provided deal input.",
      severity: "attention",
      guidance: "Confirm the exact price, currency, and what it includes.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "purchase-asset-missing",
    title: "Purchase asset missing",
    description: "Fires when the item/asset being bought or sold was not observed.",
    priority: 90,
    category: "absence",
    scope: { dealTypes: ["purchase_sale"] },
    condition: { field: "facts.purchase_sale.asset.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "The item or asset being purchased or sold was not clearly described in the provided deal input.",
      severity: "attention",
      guidance: "Describe the asset precisely, including quantity and condition.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "purchase-completion-missing",
    title: "Purchase completion date missing",
    description: "Fires when no completion/delivery date was observed.",
    priority: 85,
    category: "absence",
    scope: { dealTypes: ["purchase_sale"] },
    condition: { field: "facts.purchase_sale.completionDate.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No completion or delivery date was found in the provided deal input.",
      severity: "attention",
      guidance: "Agree on when handover and payment complete.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "purchase-title-transfer-missing",
    title: "Purchase title transfer missing",
    description: "Fires when no title/ownership transfer terms were observed.",
    priority: 80,
    category: "absence",
    scope: { dealTypes: ["purchase_sale"] },
    condition: { field: "facts.purchase_sale.titleTransfer.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No title or ownership transfer terms were found in the provided deal input.",
      severity: "attention",
      guidance: "State when ownership transfers and what must happen first.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "purchase-inspection-missing",
    title: "Purchase inspection missing",
    description: "Fires when no inspection/acceptance terms were observed.",
    priority: 70,
    category: "absence",
    scope: { dealTypes: ["purchase_sale"] },
    condition: { field: "facts.purchase_sale.inspection.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No inspection or acceptance terms were found in the provided deal input.",
      severity: "informational",
      guidance: "Add how the buyer can inspect and accept or reject.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "purchase-termination-missing",
    title: "Purchase termination missing",
    description: "Fires when no termination/cancellation terms were observed.",
    priority: 75,
    category: "absence",
    scope: { dealTypes: ["purchase_sale"] },
    condition: { field: "facts.purchase_sale.termination.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No termination or cancellation terms were found in the provided deal input.",
      severity: "attention",
      guidance: "Clarify when either side can cancel and what happens to any deposit.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "purchase-liability-uncapped",
    title: "Purchase liability uncapped",
    description: "Fires when liability language appears without any cap.",
    priority: 95,
    category: "consistency",
    scope: { dealTypes: ["purchase_sale"] },
    condition: {
      all: [
        { field: "facts.purchase_sale.liability.text", op: "exists" },
        { field: "facts.purchase_sale.liabilityCap.text", op: "missing" },
      ],
    },
    fireOn: true,
    finding: {
      summary: "Liability language appears without any cap in the provided deal input.",
      severity: "material",
      guidance: "Ask for liability to be capped, for example at the purchase price.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "purchase-deposit-missing",
    title: "Purchase deposit missing",
    description: "Fires when no deposit/down payment was observed.",
    priority: 60,
    category: "absence",
    scope: { dealTypes: ["purchase_sale"] },
    condition: { field: "facts.purchase_sale.deposit.text", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No deposit or down payment was found in the provided deal input.",
      severity: "informational",
      guidance: "Consider whether a deposit should secure the deal.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "purchase-sale-conflicting-payment-terms",
    title: "Purchase/sale conflicting payment terms",
    description: "Fires when structurally conflicting payment terms are preserved as separate observations.",
    priority: 98,
    category: "consistency",
    scope: { dealTypes: ["purchase_sale"] },
    condition: { field: "facts.purchase_sale.conflictingPaymentTerms.value", op: "eq", value: true },
    fireOn: true,
    finding: {
      summary: "Conflicting payment terms were found in the provided deal input.",
      severity: "material",
      guidance: "Clarify which payment terms apply: the input lists multiple conflicting values as separate observations. Confirm the correct schedule in writing before proceeding.",
    },
    authority: { kind: "product_policy", note: POLICY },
  }),
  rule({
    ruleKey: "purchase-sale-conflicting-timeline",
    title: "Purchase/sale conflicting timeline",
    description: "Fires when structurally conflicting timeline terms are preserved.",
    priority: 97,
    category: "consistency",
    scope: { dealTypes: ["purchase_sale"] },
    condition: { field: "facts.purchase_sale.conflictingTimelineTerms.value", op: "eq", value: true },
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

export function registerPurchaseSalePack(): Rule[] {
  const added: Rule[] = []
  for (const rule of PURCHASE_SALE_RULES) {
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

export function resetPurchaseSaleRegistration(): void {
  registered.clear()
}
