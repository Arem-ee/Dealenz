import { describe, expect, it } from "vitest"
import {
  buildRepoRows,
  countBy,
  deriveRisk,
  deriveStage,
  filterRepoRows,
  type RepoAudit,
} from "./repo"
import type { RuleResult } from "@/lib/rules/result"

function fail(severity: "critical" | "material" | "attention"): RuleResult {
  return { ruleKey: `k-${severity}`, status: "FAIL", finding: { summary: "Bad.", severity } } as unknown as RuleResult
}

function pass(): RuleResult {
  return { ruleKey: "k-ok", status: "PASS" } as unknown as RuleResult
}

function audit(over: Partial<RepoAudit> = {}): RepoAudit {
  return { id: "a1", title: "Deal", dealType: "founder", updatedAt: new Date().toISOString(), findings: [], ...over }
}

describe("deriveRisk", () => {
  it("takes the worst FAIL severity", () => {
    expect(deriveRisk([fail("attention"), fail("material")])).toEqual({ risk: "Material", openIssues: 2 })
    expect(deriveRisk([fail("attention"), fail("critical")])).toEqual({ risk: "Critical", openIssues: 2 })
  })

  it("is Clear without FAILs", () => {
    expect(deriveRisk([])).toEqual({ risk: "Clear", openIssues: 0 })
    expect(deriveRisk([pass()])).toEqual({ risk: "Clear", openIssues: 0 })
  })
})

describe("deriveStage", () => {
  it("orders Signed over Signing over Negotiation over Analysis", () => {
    expect(deriveStage(0, [])).toBe("Analysis")
    expect(deriveStage(2, [])).toBe("Negotiation")
    expect(deriveStage(0, ["draft"])).toBe("Signing")
    expect(deriveStage(3, ["draft", "locked"])).toBe("Signed")
    expect(deriveStage(0, ["fully_signed"])).toBe("Signed")
  })
})

describe("buildRepoRows + filterRepoRows", () => {
  it("builds rows and filters by type, stage, and risk combined", () => {
    const rows = buildRepoRows(
      [
        audit({ id: "a1", dealType: "founder", findings: [fail("critical")] }),
        audit({ id: "a2", dealType: "lease", findings: [] }),
      ],
      [{ auditId: "a2", status: "draft" }]
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ stage: "Negotiation", risk: "Critical", openIssues: 1 })
    expect(rows[1]).toMatchObject({ stage: "Signing", risk: "Clear", openIssues: 0 })

    expect(filterRepoRows(rows, { types: [], stages: [], risks: [] })).toHaveLength(2)
    expect(filterRepoRows(rows, { types: ["founder"], stages: [], risks: [] })).toHaveLength(1)
    expect(filterRepoRows(rows, { types: [], stages: ["Signing"], risks: ["Clear"] })).toHaveLength(1)
    expect(filterRepoRows(rows, { types: ["lease"], stages: ["Negotiation"], risks: [] })).toHaveLength(0)
  })

  it("counts rows per dimension for chips", () => {
    const rows = buildRepoRows(
      [audit({ id: "a1" }), audit({ id: "a2", dealType: "lease" })],
      []
    )
    expect(countBy(rows, (r) => r.dealType)).toEqual({ founder: 1, lease: 1 })
  })
})
