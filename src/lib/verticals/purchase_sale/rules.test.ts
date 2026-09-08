import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { selectRelevantFindings } from "@/lib/rules/result"
import { attachEvidence } from "@/lib/evidence"
import { applyUserConfirmation, seedEnvelopeForDealType } from "@/lib/context"
import type { RuleInput } from "@/lib/rules/schema"
import { PURCHASE_SALE_RULES, registerPurchaseSalePack, resetPurchaseSaleRegistration } from "./rules"
import { derivePurchaseSaleFacts } from "./facts"
import { registerFreelancePack, resetFreelanceRegistration } from "@/lib/verticals/freelance/rules"
import { registerLeasePack, resetLeaseRegistration } from "@/lib/verticals/lease/rules"
import type { ExtractedData } from "@/lib/ai/extract"

function extracted(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    goals: [],
    deliverables: [],
    timeline: null,
    budget: null,
    projectType: null,
    clientSignals: [],
    missingInformation: [],
    confidence: 0.9,
    ...overrides,
  }
}

function purchaseInput(
  rawText: string,
  data: ExtractedData,
  source?: { type: "audit_input" | "conversation_input"; id: string | null }
): RuleInput {
  const envelope = applyUserConfirmation(seedEnvelopeForDealType("purchase_sale"), {
    userRole: { value: "buyer" },
    counterpartyRole: { value: "seller" },
  })
  return {
    context: envelope,
    facts: {
      purchase_sale: JSON.parse(JSON.stringify(derivePurchaseSaleFacts(data, rawText, source))) as unknown,
    },
    knowledge: [],
    operation: "document_analysis",
    evaluatedAt: "2026-09-04T00:00:00.000Z",
  }
}

beforeEach(() => {
  clearRegistry()
  resetPurchaseSaleRegistration()
})

describe("purchase/sale rule pack", () => {
  it("discovers scoped purchase/sale rules with honest authority", () => {
    registerPurchaseSalePack()
    registerPurchaseSalePack()
    expect(PURCHASE_SALE_RULES.length).toBeGreaterThanOrEqual(5)
    expect(PURCHASE_SALE_RULES.length).toBeLessThanOrEqual(10)
    for (const rule of PURCHASE_SALE_RULES) {
      expect(rule.scope.dealTypes).toEqual(["purchase_sale"])
      expect(rule.status).toBe("active")
      expect(rule.authority.kind).toBe("product_policy")
    }
    expect(JSON.stringify(PURCHASE_SALE_RULES)).not.toMatch(/statute|case law|illegal/i)
  })

  it("fires each purchase/sale rule when its predicate is satisfied on empty input", () => {
    registerPurchaseSalePack()
    const run = evaluateApplicableRules(purchaseInput("", extracted()), "document_analysis", "purchase_sale")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("purchase-price-missing")).toBe("FAIL")
    expect(byKey.get("purchase-asset-missing")).toBe("FAIL")
    expect(byKey.get("purchase-completion-missing")).toBe("FAIL")
    expect(byKey.get("purchase-title-transfer-missing")).toBe("FAIL")
    expect(byKey.get("purchase-inspection-missing")).toBe("FAIL")
    expect(byKey.get("purchase-termination-missing")).toBe("FAIL")
    expect(byKey.get("purchase-deposit-missing")).toBe("FAIL")
  })

  it("passes when the purchase/sale states the key terms", () => {
    registerPurchaseSalePack()
    const raw =
      "Asset: 2021 delivery van. Purchase price $25,000 USD payable on completion. Deposit $2,000 on signing. Completion date 15 June 2026 with delivery at seller premises. Title transfers on full payment. Buyer may inspect before completion. Either party may terminate with 7 days notice before completion."
    const run = evaluateApplicableRules(
      purchaseInput(raw, extracted({ budget: "$25,000" })),
      "document_analysis",
      "purchase_sale"
    )
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("purchase-price-missing")).toBe("PASS")
    expect(byKey.get("purchase-asset-missing")).toBe("PASS")
    expect(byKey.get("purchase-completion-missing")).toBe("PASS")
    expect(byKey.get("purchase-title-transfer-missing")).toBe("PASS")
    expect(byKey.get("purchase-inspection-missing")).toBe("PASS")
    expect(byKey.get("purchase-termination-missing")).toBe("PASS")
    expect(byKey.get("purchase-deposit-missing")).toBe("PASS")
    const selected = selectRelevantFindings(run.results, { operation: "document_analysis" })
    expect(selected.every((f) => f.summary.length > 0)).toBe(true)
  })

  it("flags liability uncapped when liability appears without a cap", () => {
    registerPurchaseSalePack()
    const raw =
      "Asset: industrial printer. Purchase price $10,000. Completion 1 May 2026. Seller indemnifies buyer for all losses with no cap. Deposit $1,000. Title transfers on payment. Buyer may inspect. Termination on breach."
    const run = evaluateApplicableRules(purchaseInput(raw, extracted({ budget: "$10,000" })), "document_analysis", "purchase_sale")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("purchase-liability-uncapped")).toBe("FAIL")
  })

  it("passes liability-uncapped when liability is capped", () => {
    registerPurchaseSalePack()
    const raw =
      "Asset: printer. Purchase price $10,000 payable on delivery. Liability capped at purchase price. Deposit $500. Completion 1 May 2026. Title transfers on payment. Inspection allowed. Termination on breach."
    const run = evaluateApplicableRules(purchaseInput(raw, extracted({ budget: "$10,000" })), "document_analysis", "purchase_sale")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("purchase-liability-uncapped")).toBe("PASS")
  })

  it("passes liability-uncapped when no liability language exists", () => {
    registerPurchaseSalePack()
    const raw =
      "Asset: van. Purchase price $5,000. Completion 10 May 2026. Title transfers on delivery. Inspection allowed. Termination on default. Deposit $500."
    const run = evaluateApplicableRules(purchaseInput(raw, extracted({ budget: "$5,000" })), "document_analysis", "purchase_sale")
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("purchase-liability-uncapped")).toBe("PASS")
  })

  it("keeps purchase_sale rules off other deal types and vice versa", () => {
    resetFreelanceRegistration()
    resetLeaseRegistration()
    registerFreelancePack()
    registerLeasePack()
    registerPurchaseSalePack()
    const psRun = evaluateApplicableRules(purchaseInput("Asset sale.", extracted()), "document_analysis", "purchase_sale")
    const psKeys = psRun.results.map((r) => r.ruleKey)
    expect(psKeys.some((k) => k.startsWith("purchase-"))).toBe(true)
    expect(psKeys.some((k) => k.startsWith("freelance-"))).toBe(false)
    expect(psKeys.some((k) => k.startsWith("lease-"))).toBe(false)

    const freelanceRun = evaluateApplicableRules(purchaseInput("Asset sale.", extracted()), "document_analysis", "freelance")
    const fKeys = freelanceRun.results.map((r) => r.ruleKey)
    expect(fKeys.some((k) => k.startsWith("freelance-"))).toBe(true)
    expect(fKeys.some((k) => k.startsWith("purchase-"))).toBe(false)

    const leaseRun = evaluateApplicableRules(purchaseInput("Asset sale.", extracted()), "document_analysis", "lease")
    const lKeys = leaseRun.results.map((r) => r.ruleKey)
    expect(lKeys.some((k) => k.startsWith("lease-"))).toBe(true)
    expect(lKeys.some((k) => k.startsWith("purchase-"))).toBe(false)
  })

  it("runs no purchase_sale rules on unknown or generic deal types", () => {
    registerPurchaseSalePack()
    const unknownRun = evaluateApplicableRules(purchaseInput("Asset sale.", extracted()), "document_analysis", "unknown")
    expect(unknownRun.results).toEqual([])
    const genericRun = evaluateApplicableRules(purchaseInput("Asset sale.", extracted()), "document_analysis", "generic")
    expect(genericRun.results.filter((r) => r.ruleKey.startsWith("purchase-"))).toEqual([])
  })

  it("preserves UNKNOWN and produces no numeric scores", () => {
    registerPurchaseSalePack()
    const run = evaluateApplicableRules(purchaseInput("", extracted()), "document_analysis", "purchase_sale")
    for (const result of run.results) {
      expect(result).not.toHaveProperty("score")
      expect(["PASS", "FAIL", "UNKNOWN"]).toContain(result.status)
    }
    expect(JSON.stringify(run.results)).not.toMatch(/overallRisk|dealScore|riskScore/)
  })

  it("evaluates deterministically", () => {
    registerPurchaseSalePack()
    const input = purchaseInput("Asset: van. Purchase price $5,000. Completion 1 June 2026.", extracted({ budget: "$5,000" }))
    const first = evaluateApplicableRules(input, "document_analysis", "purchase_sale")
    const second = evaluateApplicableRules(JSON.parse(JSON.stringify(input)) as RuleInput, "document_analysis", "purchase_sale")
    expect(second).toEqual(first)
  })

  it("carries evidence from fact to rule to finding end to end", () => {
    registerPurchaseSalePack()
    const raw = "Asset: van. Purchase price $5,000. Completion 1 June 2026. Title transfers on full payment. Inspection before completion. Termination on breach. Deposit $500."
    const input = purchaseInput(raw, extracted({ budget: "$5,000" }))
    const run = evaluateApplicableRules(input, "document_analysis", "purchase_sale")
    const enriched = attachEvidence(run.results, input, "document_analysis", "purchase_sale")
    // Presence is PASS with no evidence needed; absence FAIL carries no evidence.
    const missingPriceInput = purchaseInput("Asset: van.", extracted())
    const missingRun = evaluateApplicableRules(missingPriceInput, "document_analysis", "purchase_sale")
    const missingEnriched = attachEvidence(missingRun.results, missingPriceInput, "document_analysis", "purchase_sale")
    const hit = missingEnriched.find((r) => r.ruleKey === "purchase-price-missing")
    expect(hit?.status).toBe("FAIL")
    expect(hit?.finding?.evidence ?? []).toEqual([])
    // Uncapped liability FAIL carries observed liability evidence.
    const rawLiab = "Asset: printer. Purchase price $10,000. Completion 1 May 2026. Seller assumes liability for all defects. No cap. Title transfers on payment. Inspection allowed. Termination on breach. Deposit $500."
    const liabInput = purchaseInput(rawLiab, extracted({ budget: "$10,000" }))
    const liabRun = evaluateApplicableRules(liabInput, "document_analysis", "purchase_sale")
    const liabEnriched = attachEvidence(liabRun.results, liabInput, "document_analysis", "purchase_sale")
    const liabHit = liabEnriched.find((r) => r.ruleKey === "purchase-liability-uncapped")
    expect(liabHit?.status).toBe("FAIL")
    const evidence = liabHit?.finding?.evidence ?? []
    expect(evidence.length).toBeGreaterThan(0)
    expect(evidence[0].observationKey).toBe("facts.purchase_sale.liability")
    expect(evidence[0].quote).toMatch(/liab/i)
    expect(evidence[0].location.kind).toBe("approximate")
  })

  it("carries exact evidence when the source is an inspectable audit", () => {
    registerPurchaseSalePack()
    const rawText = "Asset: van. Purchase price $5,000. Seller is liable for defects with no cap stated."
    const input = purchaseInput(rawText, extracted({ budget: "$5,000" }), { type: "audit_input", id: "audit-ps-1" })
    const run = evaluateApplicableRules(input, "document_analysis", "purchase_sale")
    const enriched = attachEvidence(run.results, input, "document_analysis", "purchase_sale")
    const hit = enriched.find((r) => r.ruleKey === "purchase-liability-uncapped")
    expect(hit?.status).toBe("FAIL")
    const evidence = hit?.finding?.evidence ?? []
    expect(evidence.length).toBeGreaterThan(0)
    expect(evidence[0].location.kind).toBe("exact")
    expect(evidence[0].sourceId).toBe("audit-ps-1")
    const location = evidence[0].location
    if (location.kind === "exact") {
      expect(rawText.slice(location.startOffset, location.endOffset)).toMatch(/liab/i)
    } else {
      throw new Error("expected exact location")
    }
  })
})
