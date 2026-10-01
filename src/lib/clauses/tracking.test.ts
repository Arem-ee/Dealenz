import { describe, expect, it } from "vitest"
import {
  deriveClauseTracking,
  suggestedClauseIdsForFindings,
  unresolvedVariables,
  type ClauseTrackingAudit,
  type ClauseTrackingVersion,
} from "./tracking"
import type { RuleResult } from "@/lib/rules/result"

function failFinding(ruleKey: string): RuleResult {
  return {
    ruleKey,
    status: "FAIL",
    finding: {
      severity: "critical",
      summary: "Ownership split is not recorded.",
      guidance: "Record the split before signing.",
      evidence: [],
    },
  } as unknown as RuleResult
}

function audit(over: Partial<ClauseTrackingAudit> = {}): ClauseTrackingAudit {
  return {
    id: "audit-1",
    title: "Founder deal",
    dealType: "founder",
    updatedAt: new Date().toISOString(),
    findings: [],
    ...over,
  }
}

function version(over: Partial<ClauseTrackingVersion> = {}): ClauseTrackingVersion {
  return {
    id: "v-1",
    auditId: "audit-1",
    documentType: "founder-agreement",
    versionNumber: 1,
    status: "draft",
    createdAt: new Date().toISOString(),
    ...over,
  }
}

describe("unresolvedVariables", () => {
  it("extracts distinct {{variables}} sorted", () => {
    expect(unresolvedVariables("Pay {{company_name}} to {{founder_names}} and {{company_name}}.")).toEqual([
      "company_name",
      "founder_names",
    ])
  })

  it("returns empty when all variables are resolved", () => {
    expect(unresolvedVariables("No placeholders here.")).toEqual([])
  })
})

describe("suggestedClauseIdsForFindings", () => {
  it("suggests ownership clauses for founder ownership FAILs", () => {
    const ids = suggestedClauseIdsForFindings("founder", [failFinding("founder-ownership-missing")])
    expect(ids).toContain("founder-ownership-allocation")
  })

  it("suggests nothing without FAIL findings", () => {
    expect(suggestedClauseIdsForFindings("founder", [])).toEqual([])
  })

  it("suggests nothing for deal types without a clause library", () => {
    expect(suggestedClauseIdsForFindings("freelance", [failFinding("freelance-payment-risk")])).toEqual([])
  })
})

describe("deriveClauseTracking", () => {
  it("marks suggested clauses for findings with no generated documents", () => {
    const [deal] = deriveClauseTracking([audit({ findings: [failFinding("founder-ownership-missing")] })], [])
    expect(deal.clauses.length).toBeGreaterThan(0)
    expect(deal.clauses.every((c) => c.status === "suggested")).toBe(true)
    expect(deal.clauses.every((c) => c.familyId === null)).toBe(true)
  })

  it("marks draft clauses when a family version exists", () => {
    const [deal] = deriveClauseTracking([audit()], [version({ content: "Fully resolved text." })])
    const ownership = deal.clauses.find((c) => c.clauseId === "founder-ownership-allocation")!
    expect(ownership.status).toBe("draft")
    expect(ownership.familyId).toBe("founder-agreement")
    expect(ownership.versionNumber).toBe(1)
  })

  it("marks needs_input when the latest content still has {{variables}}", () => {
    const [deal] = deriveClauseTracking(
      [audit()],
      [version({ content: "Held as follows: {{founder_names}} in {{ownership_percentages}}." })]
    )
    const ownership = deal.clauses.find((c) => c.clauseId === "founder-ownership-allocation")!
    expect(ownership.status).toBe("needs_input")
    expect(ownership.missingVariables).toEqual(["founder_names", "ownership_percentages"])
  })

  it("marks signed when the latest version is locked", () => {
    const [deal] = deriveClauseTracking(
      [audit()],
      [version({ status: "locked", versionNumber: 2, content: "Resolved." })]
    )
    expect(deal.clauses.every((c) => c.status === "signed")).toBe(true)
  })

  it("keeps previouslySigned when a redraft follows a locked version", () => {
    const [deal] = deriveClauseTracking(
      [audit()],
      [
        version({ id: "v-1", versionNumber: 1, status: "locked", content: "Resolved." }),
        version({ id: "v-2", versionNumber: 2, status: "draft", content: "Resolved." }),
      ]
    )
    const ownership = deal.clauses.find((c) => c.clauseId === "founder-ownership-allocation")!
    expect(ownership.status).toBe("draft")
    expect(ownership.previouslySigned).toBe(true)
  })

  it("ignores non-family document types", () => {
    const [deal] = deriveClauseTracking(
      [audit({ findings: [failFinding("founder-ownership-missing")] })],
      [version({ documentType: "proposal", content: "Resolved." })]
    )
    expect(deal.clauses.every((c) => c.status === "suggested")).toBe(true)
  })

  it("returns an empty clause list for deals with no findings and no versions", () => {
    const [deal] = deriveClauseTracking([audit()], [])
    expect(deal.clauses).toEqual([])
  })
})
