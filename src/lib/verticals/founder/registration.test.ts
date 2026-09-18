import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { verticalForDealType } from "../index"
import { normalizeDealType } from "@/lib/deal-type"

describe("founder registration", () => {
  it("resolves founder through the single dispatcher", () => {
    expect(verticalForDealType("founder")?.key).toBe("founder")
    expect(verticalForDealType("partnership")?.key).toBe("partnership")
    expect(verticalForDealType("unknown")).toBeNull()
  })

  it("normalizes founder in authenticated paths (context + audit creation share one helper)", () => {
    expect(normalizeDealType("founder")).toBe("founder")
    expect(normalizeDealType("bogus")).toBe("freelance")
    expect(normalizeDealType(null)).toBe("freelance")
    expect(normalizeDealType(undefined)).toBe("freelance")
  })

  it("migration 00032 extends the deal_type check to founder", () => {
    const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "00032_allow_founder_deal_type.sql"), "utf8")
    for (const dealType of ["freelance", "generic", "lease", "purchase_sale", "employment", "founder"]) {
      expect(sql).toContain(`'${dealType}'`)
    }
    expect(sql).toMatch(/audits_deal_type_check/)
  })

  it("keeps founder rules off generic and generic rules off founder", async () => {
    const { clearRegistry, evaluateApplicableRules } = await import("@/lib/rules/registry")
    const { registerFounderPack, resetFounderRegistration } = await import("./rules")
    const { registerGenericPack, resetGenericRegistration } = await import("../generic/rules")
    const { deriveFounderFacts } = await import("./facts")
    const { seedEnvelopeForDealType, applyUserConfirmation } = await import("@/lib/context")
    clearRegistry()
    resetFounderRegistration()
    resetGenericRegistration()
    registerFounderPack()
    registerGenericPack()
    const envelope = applyUserConfirmation(seedEnvelopeForDealType("founder"), {
      userRole: { value: "founder" },
    })
    const input = {
      context: envelope,
      facts: {
        founder: JSON.parse(
          JSON.stringify(deriveFounderFacts({ goals: [], deliverables: [], timeline: null, budget: null, projectType: null, clientSignals: [], missingInformation: [], confidence: 0.9 }, "Founder deal.", undefined))
        ) as unknown,
      },
      knowledge: [],
      operation: "document_analysis" as const,
      evaluatedAt: "2026-09-04T00:00:00.000Z",
    }
    const founderKeys = evaluateApplicableRules(input, "document_analysis", "founder").results.map((r) => r.ruleKey)
    expect(founderKeys.some((k) => k.startsWith("founder-"))).toBe(true)
    expect(founderKeys.some((k) => k.startsWith("generic-"))).toBe(false)
    const genericKeys = evaluateApplicableRules(input, "document_analysis", "generic").results.map((r) => r.ruleKey)
    expect(genericKeys.some((k) => k.startsWith("generic-"))).toBe(true)
    expect(genericKeys.some((k) => k.startsWith("founder-"))).toBe(false)
  })
})
