import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import type { RuleInput } from "@/lib/rules/schema"
import { seedEnvelopeForDealType } from "@/lib/context"
import type { ExtractedData } from "@/lib/ai/extract"
import { deriveLeaseFacts } from "./lease/facts"
import { registerLeasePack, resetLeaseRegistration } from "./lease/rules"
import { derivePurchaseSaleFacts } from "./purchase_sale/facts"
import { registerPurchaseSalePack, resetPurchaseSaleRegistration } from "./purchase_sale/rules"
import { deriveEmploymentFacts } from "./employment/facts"
import { registerEmploymentPack, resetEmploymentRegistration } from "./employment/rules"
import { deriveFounderFacts } from "./founder/facts"
import { registerFounderPack, resetFounderRegistration } from "./founder/rules"
import { derivePartnershipFacts } from "./partnership/facts"
import { registerPartnershipPack, resetPartnershipRegistration } from "./partnership/rules"

// Cross-vertical conflict coverage: every non-generic deal type preserves
// conflicting budget/timeline observations as separate terms and fires
// material consistency findings. (Freelance + generic covered elsewhere.)

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

const conflicted = () =>
  extracted({
    budget: "Net 15; Net 30",
    budgetTerms: ["Net 15", "Net 30"],
    timeline: "2026-01-01; 2026-06-01",
    timelineTerms: ["2026-01-01", "2026-06-01"],
  })

const clean = () =>
  extracted({
    budget: "$5,000 net 30",
    budgetTerms: ["$5,000 net 30"],
    timeline: "30 days",
    timelineTerms: ["30 days"],
  })

function inputFor(dealType: "lease" | "purchase_sale" | "employment" | "founder" | "partnership", facts: unknown): RuleInput {
  return {
    context: seedEnvelopeForDealType(dealType),
    facts: { [dealType]: JSON.parse(JSON.stringify(facts)) as unknown },
    knowledge: [],
    operation: "document_analysis",
    evaluatedAt: "2026-09-04T00:00:00.000Z",
  }
}

beforeEach(() => {
  clearRegistry()
  resetLeaseRegistration()
  resetPurchaseSaleRegistration()
  resetEmploymentRegistration()
  resetFounderRegistration()
  resetPartnershipRegistration()
})

describe("conflicting-terms coverage across verticals", () => {
  const cases = [
    {
      dealType: "lease",
      derive: deriveLeaseFacts,
      register: registerLeasePack,
      paymentKey: "lease-conflicting-payment-terms",
      timelineKey: "lease-conflicting-timeline",
    },
    {
      dealType: "purchase_sale",
      derive: derivePurchaseSaleFacts,
      register: registerPurchaseSalePack,
      paymentKey: "purchase-sale-conflicting-payment-terms",
      timelineKey: "purchase-sale-conflicting-timeline",
    },
    {
      dealType: "employment",
      derive: deriveEmploymentFacts,
      register: registerEmploymentPack,
      paymentKey: "employment-conflicting-payment-terms",
      timelineKey: "employment-conflicting-timeline",
    },
    {
      dealType: "founder",
      derive: deriveFounderFacts,
      register: registerFounderPack,
      paymentKey: "founder-conflicting-payment-terms",
      timelineKey: "founder-conflicting-timeline",
    },
    {
      dealType: "partnership",
      derive: derivePartnershipFacts,
      register: registerPartnershipPack,
      paymentKey: "partnership-conflicting-payment-terms",
      timelineKey: "partnership-conflicting-timeline",
    },
  ] as const

  for (const c of cases) {
    it(`${c.dealType}: conflicting terms surface as material findings`, () => {
      const facts = c.derive(conflicted()) as unknown as Record<string, { value: unknown }>
      expect(facts.conflictingPaymentTerms.value).toBe(true)
      expect(facts.conflictingTimelineTerms.value).toBe(true)
      c.register()
      const run = evaluateApplicableRules(inputFor(c.dealType, facts), "document_analysis", c.dealType)
      const byKey = new Map(run.results.map((r) => [r.ruleKey, r]))
      const payment = byKey.get(c.paymentKey)
      const timeline = byKey.get(c.timelineKey)
      expect(payment?.status).toBe("FAIL")
      expect(timeline?.status).toBe("FAIL")
      expect(payment?.finding?.severity).toBe("material")
      expect(timeline?.finding?.severity).toBe("material")
      expect(payment?.finding?.summary).toMatch(/Conflicting payment terms/)
      expect(timeline?.finding?.summary).toMatch(/Conflicting timeline terms/)
    })

    it(`${c.dealType}: single terms stay quiet`, () => {
      const facts = c.derive(clean()) as unknown as Record<string, { value: unknown }>
      expect(facts.conflictingPaymentTerms.value).toBeNull()
      expect(facts.conflictingTimelineTerms.value).toBeNull()
      c.register()
      const run = evaluateApplicableRules(inputFor(c.dealType, facts), "document_analysis", c.dealType)
      const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
      expect(byKey.get(c.paymentKey)).not.toBe("FAIL")
      expect(byKey.get(c.timelineKey)).not.toBe("FAIL")
    })
  }
})
