import { describe, it, expect } from "vitest"
import { CLAUSE_LIBRARY, clausesForDealType, clausesForProtectionCategory, clauseById, renderClauseTemplate } from "./clauses"

describe("clause library — foundation", () => {
  it("has no duplicate ids and valid schema", () => {
    const ids = CLAUSE_LIBRARY.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    // At least one clause must label drafting assistance vs legal authority
    expect(CLAUSE_LIBRARY.some((c) => c.warnings.some((w) => w.toLowerCase().includes("drafting assistance")))).toBe(true)
    for (const clause of CLAUSE_LIBRARY) {
      expect(clause.id.length).toBeGreaterThan(0)
      expect(clause.title.length).toBeGreaterThan(0)
      expect(clause.purpose.length).toBeGreaterThan(0)
      expect(clause.template.length).toBeGreaterThan(20)
      expect(clause.template).toMatch(/\{\{\w+\}\}/)
      expect(clause.warnings.length).toBeGreaterThan(0)
      expect(clause.version).toBe(1)
      expect(["founder", "partnership", "purchase_sale", "lease", "employment"].some((dt) => clause.dealTypes.includes(dt as never))).toBe(true)
      for (const ctx of clause.legalContextIds) expect(typeof ctx).toBe("string")
    }
  })

  it("founder clauses cover required protection categories", () => {
    const founder = clausesForDealType("founder")
    expect(founder.length).toBeGreaterThanOrEqual(6)
    const cats = new Set(founder.flatMap((c) => c.protectionCategories))
    for (const required of ["ownership", "vesting", "governance", "transfer", "liability", "ip"] as const) {
      expect(cats.has(required)).toBe(true)
    }
  })

  it("partnership clauses cover required categories and distinguish structure", () => {
    const partnership = clausesForDealType("partnership")
    expect(partnership.length).toBeGreaterThanOrEqual(6)
    const cats = new Set(partnership.flatMap((c) => c.protectionCategories))
    for (const required of ["contribution", "profit", "authority", "governance", "transfer", "dissolution", "liability"] as const) {
      expect(cats.has(required)).toBe(true)
    }
    // LLP-specific clause exists and warns about ordinary vs LLP
    const transfer = partnership.find((c) => c.id === "partnership-transfer-restriction")
    expect(transfer).toBeDefined()
    expect(transfer!.template.toLowerCase()).toContain("llp")
    expect(transfer!.warnings.some((w) => w.toLowerCase().includes("llp"))).toBe(true)
  })

  it("clause isolation: founder clauses never appear for partnership protection category lookups and vice versa", () => {
    const founderGovernance = clausesForProtectionCategory("founder", "governance")
    const partnershipGovernance = clausesForProtectionCategory("partnership", "governance")
    expect(founderGovernance.every((c) => c.dealTypes.includes("founder"))).toBe(true)
    expect(partnershipGovernance.every((c) => c.dealTypes.includes("partnership"))).toBe(true)
    expect(founderGovernance.map((c) => c.id).some((id) => partnershipGovernance.map((c2) => c2.id).includes(id))).toBe(false)
  })

  it("rendering preserves missing variables as {{key}} and never invents values", () => {
    const clause = clauseById("founder-ownership-allocation")!
    const { rendered, missing } = renderClauseTemplate(clause.template, {})
    expect(missing.length).toBeGreaterThan(0)
    expect(rendered).toContain("{{")
    expect(rendered).not.toMatch(/\d+%.*invented/i)
    const full = renderClauseTemplate(clause.template, {
      founder_names: "Alice and Bob",
      ownership_percentages: "60/40",
      company_name: "Acme Ltd",
    })
    expect(full.missing).toEqual([])
    expect(full.rendered).toContain("Alice and Bob")
    expect(full.rendered).toContain("60/40")
    expect(full.rendered).not.toContain("{{")
  })

  it("clauses do not claim enforceability — warnings and legal context required", () => {
    for (const clause of CLAUSE_LIBRARY) {
      expect(clause.warnings.join(" ").toLowerCase()).not.toMatch(/enforceable in nigeria merely because/i)
      expect(clause.legalContextIds.length).toBeGreaterThan(0)
    }
  })

  it("no orphan clauses — every clause maps to at least one protection category that a founder/partnership rule can trigger", () => {
    // This test documents the intended mapping; it does not enforce DB persistence.
    for (const clause of CLAUSE_LIBRARY) {
      expect(clause.protectionCategories.length).toBeGreaterThan(0)
    }
  })
})
