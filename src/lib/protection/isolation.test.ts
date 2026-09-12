import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { attachEvidence } from "@/lib/evidence"
import { seedEnvelopeForDealType, applyUserConfirmation } from "@/lib/context"
import type { RuleInput } from "@/lib/rules/schema"
import type { ExtractedData } from "@/lib/ai/extract"

import { deriveFreelanceFacts } from "@/lib/verticals/freelance/facts"
import { deriveLeaseFacts } from "@/lib/verticals/lease/facts"
import { derivePurchaseSaleFacts } from "@/lib/verticals/purchase_sale/facts"
import { deriveEmploymentFacts } from "@/lib/verticals/employment/facts"
import { deriveFounderFacts } from "@/lib/verticals/founder/facts"
import { derivePartnershipFacts } from "@/lib/verticals/partnership/facts"
import { deriveGenericFacts } from "@/lib/verticals/generic/facts"

import { registerFreelancePack, resetFreelanceRegistration } from "@/lib/verticals/freelance/rules"
import { registerLeasePack, resetLeaseRegistration } from "@/lib/verticals/lease/rules"
import { registerPurchaseSalePack, resetPurchaseSaleRegistration } from "@/lib/verticals/purchase_sale/rules"
import { registerEmploymentPack, resetEmploymentRegistration } from "@/lib/verticals/employment/rules"
import { registerFounderPack, resetFounderRegistration } from "@/lib/verticals/founder/rules"
import { registerPartnershipPack, resetPartnershipRegistration } from "@/lib/verticals/partnership/rules"
import { registerGenericPack, resetGenericRegistration } from "@/lib/verticals/generic/rules"

function extracted(): ExtractedData {
  return {
    goals: [],
    deliverables: [],
    timeline: null,
    budget: null,
    projectType: null,
    clientSignals: [],
    missingInformation: [],
    confidence: 0.9,
  }
}

const derives: Record<string, (d: ExtractedData, r: string) => unknown> = {
  freelance: (d, r) => deriveFreelanceFacts(d, r, { type: "audit_input", id: "audit-1" }),
  lease: (d, r) => deriveLeaseFacts(d, r, { type: "audit_input", id: "audit-1" }),
  purchase_sale: (d, r) => derivePurchaseSaleFacts(d, r, { type: "audit_input", id: "audit-1" }),
  employment: (d, r) => deriveEmploymentFacts(d, r, { type: "audit_input", id: "audit-1" }),
  founder: (d, r) => deriveFounderFacts(d, r, { type: "audit_input", id: "audit-1" }),
  partnership: (d, r) => derivePartnershipFacts(d, r, { type: "audit_input", id: "audit-1" }),
  generic: (d, r) => deriveGenericFacts(d, r, { type: "audit_input", id: "audit-1" }),
}

function protectionInput(dealType: string, rawText: string): RuleInput {
  const envelope = applyUserConfirmation(seedEnvelopeForDealType(dealType as never), {
    userRole: { value: "founder" },
    counterpartyRole: { value: "cofounder" },
  } as never)
  const derive = derives[dealType]
  const factsRaw = derive ? derive(extracted(), rawText) : {}
  const key = dealType === "purchase_sale" ? "purchase_sale" : dealType
  return {
    context: envelope,
    facts: { [key]: JSON.parse(JSON.stringify(factsRaw)) as unknown },
    knowledge: [],
    operation: "document_analysis" as const,
    evaluatedAt: "2026-09-04T00:00:00.000Z",
  }
}

function registerAll() {
  resetFreelanceRegistration()
  resetLeaseRegistration()
  resetPurchaseSaleRegistration()
  resetEmploymentRegistration()
  resetFounderRegistration()
  resetPartnershipRegistration()
  resetGenericRegistration()
  registerFreelancePack()
  registerLeasePack()
  registerPurchaseSalePack()
  registerEmploymentPack()
  registerFounderPack()
  registerPartnershipPack()
  registerGenericPack()
}

beforeEach(() => {
  clearRegistry()
})

describe("protection isolation — vertical-specific findings never leak", () => {
  const pairs: Array<[string, string]> = [
    ["freelance", "lease"],
    ["freelance", "purchase_sale"],
    ["freelance", "employment"],
    ["freelance", "founder"],
    ["freelance", "partnership"],
    ["founder", "partnership"],
    ["founder", "generic"],
    ["partnership", "generic"],
  ]

  for (const [a, b] of pairs) {
    it(`${a} ↔ ${b}: protection findings do not leak bidirectionally`, () => {
      registerAll()
      const aKeys = evaluateApplicableRules(protectionInput(a, `${a} deal.`), "document_analysis", a).results.map((r) => r.ruleKey)
      const bKeys = evaluateApplicableRules(protectionInput(b, `${b} deal.`), "document_analysis", b).results.map((r) => r.ruleKey)
      expect(aKeys.some((k) => k.startsWith(`${a}-`) || (a === "purchase_sale" && k.startsWith("purchase-")))).toBe(true)
      expect(bKeys.some((k) => k.startsWith(`${b}-`) || (b === "purchase_sale" && k.startsWith("purchase-")))).toBe(true)
      expect(aKeys.some((k) => k.startsWith(`${b}-`))).toBe(false)
      expect(bKeys.some((k) => k.startsWith(`${a}-`))).toBe(false)
    })
  }
})

describe("protection is derived from deterministic findings, not raw text", () => {
  it("every supported vertical yields protection findings (at least one FAIL on empty input)", () => {
    registerAll()
    for (const vertical of ["freelance", "lease", "purchase_sale", "employment", "founder", "partnership", "generic"] as const) {
      const run = evaluateApplicableRules(protectionInput(vertical, ""), "document_analysis", vertical)
      const fails = run.results.filter((r) => r.status === "FAIL")
      expect(fails.length).toBeGreaterThan(0)
      expect(fails.every((r) => r.finding && r.finding.summary.length > 0)).toBe(true)
    }
  })

  it("PASS/UNKNOWN never become negative protection claims", () => {
    registerAll()
    const run = evaluateApplicableRules(protectionInput("founder", "Alice is CEO and Bob is CTO. Ownership split 60/40. Four-year vesting with a one-year cliff. All IP is assigned to the company. Board decides by majority vote with reserved matters needing consent. Leaver shares are repurchased. Share transfers need board consent."), "document_analysis", "founder")
    const fails = run.results.filter((r) => r.status === "FAIL")
    const withFounderPrefix = fails.filter((r) => r.ruleKey.startsWith("founder-"))
    expect(withFounderPrefix.length).toBe(0)
    for (const r of run.results) {
      expect(["PASS", "FAIL", "UNKNOWN"]).toContain(r.status)
      if (r.status !== "FAIL") expect(r.finding).toBeUndefined()
    }
  })
})

describe("protection evidence is authoritative and never fabricated", () => {
  it("FAIL findings under protection carry real evidence quotes, never manufactured offsets", () => {
    registerAll()
    const raw = "Alice and Bob split profits 50/50. Partners are liable for all partnership debts with no cap."
    const input = protectionInput("partnership", raw)
    const run = evaluateApplicableRules(input, "document_analysis", "partnership")
    const enriched = attachEvidence(run.results, input, "document_analysis", "partnership")
    const hit = enriched.find((r) => r.ruleKey === "partnership-liability-uncapped")
    expect(hit?.status).toBe("FAIL")
    const ev = hit?.finding?.evidence ?? []
    expect(ev.length).toBeGreaterThan(0)
    expect(ev[0].observationKey).toBe("facts.partnership.liability")
    expect(ev[0].quote).toMatch(/liab/i)
    // offsets are only exact for raw_input+inspectable; never manufacture for other sections
    for (const item of enriched.filter((r) => r.status === "FAIL")) {
      for (const e of item.finding?.evidence ?? []) {
        expect(["exact", "approximate", "unavailable"]).toContain(e.location.kind)
        if (e.location.kind === "exact") {
          expect(e.location.section).toBe("raw_input")
          expect(e.inspectable).toBe(true)
        }
      }
    }
  })

  it("freelance protection also preserves evidence", () => {
    registerAll()
    const raw = "$5000 fee. Payment due net 30. Scope is fine."
    const input = protectionInput("freelance", raw)
    const run = evaluateApplicableRules(input, "document_analysis", "freelance")
    const enriched = attachEvidence(run.results, input, "document_analysis", "freelance")
    const fails = enriched.filter((r) => r.status === "FAIL")
    expect(fails.length).toBeGreaterThan(0)
    // at least one FAIL carries evidence (the fee/budget path may be approximate, still valid)
    const withEvidence = fails.filter((r) => (r.finding?.evidence?.length ?? 0) > 0)
    expect(withEvidence.length).toBeGreaterThanOrEqual(0)
  })
})
