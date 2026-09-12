import { describe, it, expect } from "vitest"
import {
  CLAUSE_LIBRARY,
  clausesForDealType,
  clausesForProtectionCategory,
  renderClauseTemplate,
} from "./clauses"
import { INTERNATIONAL_LEGAL_CORPUS } from "@/lib/legal-research/corpus"

describe("Tier 2 clause library (purchase_sale / lease / employment)", () => {
  it("provides drafting support per Tier 2 deal type without touching founder/partnership", () => {
    for (const dealType of ["purchase_sale", "lease", "employment"] as const) {
      const clauses = clausesForDealType(dealType)
      expect(clauses.length).toBeGreaterThanOrEqual(3)
      expect(clauses.every((c) => c.dealTypes.includes(dealType))).toBe(true)
    }
    // Founder/partnership libraries unchanged in size
    expect(clausesForDealType("founder").length).toBe(8)
    expect(clausesForDealType("partnership").length).toBe(8)
  })

  it("covers the Tier 2 intent categories users actually see", () => {
    expect(clausesForProtectionCategory("purchase_sale", "payment").length).toBeGreaterThan(0)
    expect(clausesForProtectionCategory("purchase_sale", "warranty").length).toBeGreaterThan(0)
    expect(clausesForProtectionCategory("purchase_sale", "transfer").length).toBeGreaterThan(0)
    expect(clausesForProtectionCategory("lease", "payment").length).toBeGreaterThan(0)
    expect(clausesForProtectionCategory("lease", "term").length).toBeGreaterThan(0)
    expect(clausesForProtectionCategory("lease", "termination").length).toBeGreaterThan(0)
    expect(clausesForProtectionCategory("lease", "maintenance").length).toBeGreaterThan(0)
    expect(clausesForProtectionCategory("lease", "transfer").length).toBeGreaterThan(0)
    expect(clausesForProtectionCategory("employment", "compensation").length).toBeGreaterThan(0)
    expect(clausesForProtectionCategory("employment", "termination").length).toBeGreaterThan(0)
  })

  it("every Tier 2 clause is drafting assistance with preserved variables", () => {
    const tier2 = CLAUSE_LIBRARY.filter((c) =>
      c.dealTypes.some((d) => ["purchase_sale", "lease", "employment"].includes(d))
    )
    expect(tier2.length).toBe(10)
    for (const clause of tier2) {
      expect(clause.warnings.length).toBeGreaterThan(0)
      expect(clause.warnings.join(" ").toLowerCase()).toMatch(/drafting assistance/)
      expect(clause.variables.length).toBeGreaterThan(0)
      const { rendered, missing } = renderClauseTemplate(clause.template, {})
      // Missing variables stay as {{var}}, never invented
      expect(missing.length).toBe(clause.variables.length)
      expect(rendered).toMatch(/\{\{\w+\}\}/)
      // No clause claims to be law
      expect(clause.template.toLowerCase()).not.toMatch(/this (is|constitutes) law/i)
    }
  })

  it("Tier 2 clause legalContextIds all resolve to real corpus sources", () => {
    const ids = new Set(INTERNATIONAL_LEGAL_CORPUS.map((s) => s.id))
    for (const clause of CLAUSE_LIBRARY) {
      for (const id of clause.legalContextIds) {
        expect(ids.has(id)).toBe(true)
      }
    }
  })

  it("vertical isolation: Tier 2 clauses never leak into founder/partnership and vice versa", () => {
    expect(clausesForDealType("founder").some((c) => c.dealTypes.includes("purchase_sale" as never))).toBe(false)
    expect(clausesForDealType("purchase_sale").some((c) => c.dealTypes.includes("founder" as never))).toBe(false)
    expect(clausesForDealType("lease").some((c) => c.dealTypes.includes("partnership" as never))).toBe(false)
  })
})
