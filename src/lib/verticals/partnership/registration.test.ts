import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { verticalForDealType } from "../index"
import { normalizeAnonymousDealType, normalizeDealType } from "@/lib/deal-type"

describe("partnership registration", () => {
  it("resolves partnership through the single dispatcher", () => {
    expect(verticalForDealType("partnership")?.key).toBe("partnership")
    expect(verticalForDealType("unknown")).toBeNull()
    expect(verticalForDealType("")).toBeNull()
  })

  it("normalizes partnership in authenticated paths (context + audit creation share one helper)", () => {
    expect(normalizeDealType("partnership")).toBe("partnership")
    expect(normalizeDealType("bogus")).toBe("freelance")
    expect(normalizeDealType(null)).toBe("freelance")
    expect(normalizeDealType(undefined)).toBe("freelance")
  })

  it("normalizes partnership in anonymous analysis", () => {
    expect(normalizeAnonymousDealType("partnership")).toBe("partnership")
    expect(normalizeAnonymousDealType("bogus")).toBe("generic")
    expect(normalizeAnonymousDealType()).toBe("generic")
  })

  it("migration 00034 extends the deal_type check to partnership", () => {
    const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "00034_allow_partnership_deal_type.sql"), "utf8")
    for (const dealType of ["freelance", "generic", "lease", "purchase_sale", "employment", "founder", "partnership"]) {
      expect(sql).toContain(`'${dealType}'`)
    }
    expect(sql).toMatch(/audits_deal_type_check/)
  })

  it("keeps partnership rules off generic and generic rules off partnership", async () => {
    const { clearRegistry, evaluateApplicableRules } = await import("@/lib/rules/registry")
    const { registerPartnershipPack, resetPartnershipRegistration } = await import("./rules")
    const { registerGenericPack, resetGenericRegistration } = await import("../generic/rules")
    const { derivePartnershipFacts } = await import("./facts")
    const { seedEnvelopeForDealType, applyUserConfirmation } = await import("@/lib/context")
    clearRegistry()
    resetPartnershipRegistration()
    resetGenericRegistration()
    registerPartnershipPack()
    registerGenericPack()
    const envelope = applyUserConfirmation(seedEnvelopeForDealType("partnership"), {
      userRole: { value: "partner" },
    })
    const input = {
      context: envelope,
      facts: {
        partnership: JSON.parse(
          JSON.stringify(derivePartnershipFacts({ goals: [], deliverables: [], timeline: null, budget: null, projectType: null, clientSignals: [], missingInformation: [], confidence: 0.9 }, "Partnership deal.", undefined))
        ) as unknown,
      },
      knowledge: [],
      operation: "document_analysis" as const,
      evaluatedAt: "2026-09-04T00:00:00.000Z",
    }
    const partnershipKeys = evaluateApplicableRules(input, "document_analysis", "partnership").results.map((r) => r.ruleKey)
    expect(partnershipKeys.some((k) => k.startsWith("partnership-"))).toBe(true)
    expect(partnershipKeys.some((k) => k.startsWith("generic-"))).toBe(false)
    const genericKeys = evaluateApplicableRules(input, "document_analysis", "generic").results.map((r) => r.ruleKey)
    expect(genericKeys.some((k) => k.startsWith("generic-"))).toBe(true)
    expect(genericKeys.some((k) => k.startsWith("partnership-"))).toBe(false)
  })
})
