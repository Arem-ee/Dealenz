import { describe, it, expect } from "vitest"
import { deriveOpenItems, getOpenItemsFromAudit } from "./open-items"
import type { RuleResult, Finding } from "@/lib/rules/result"

const mockFailFinding: Finding = {
  ruleKey: "freelance-scope-vague",
  ruleVersion: 1,
  summary: "No concrete deliverables were identified for this deal.",
  severity: "attention",
  guidance: "List exactly what will be delivered so scope stays measurable.",
  authority: { kind: "product_policy", note: "Dealenz product judgment" },
}

const mockCriticalFinding: Finding = {
  ruleKey: "freelance-unlimited-revisions",
  ruleVersion: 1,
  summary: "The deal promises unlimited revisions.",
  severity: "critical",
  guidance: "Cap revisions at a fixed number with a fee for extras.",
  authority: { kind: "product_policy", note: "Dealenz product judgment" },
}

const mockUnknownReason = "Cannot determine 'freelance-termination-missing': required inputs unavailable."

const mockRuleResults: RuleResult[] = [
  {
    ruleKey: "freelance-scope-vague",
    ruleVersion: "v1",
    status: "FAIL",
    finding: mockFailFinding,
    reason: 'Rule "freelance-scope-vague" v1 fired.',
    authority: { kind: "product_policy", note: "Dealenz product judgment" },
    evaluatedAt: "2024-01-01T00:00:00Z",
  },
  {
    ruleKey: "freelance-unlimited-revisions",
    ruleVersion: "v1",
    status: "FAIL",
    finding: mockCriticalFinding,
    reason: 'Rule "freelance-unlimited-revisions" v1 fired.',
    authority: { kind: "product_policy", note: "Dealenz product judgment" },
    evaluatedAt: "2024-01-01T00:00:00Z",
  },
  {
    ruleKey: "freelance-termination-missing",
    ruleVersion: "v1",
    status: "UNKNOWN",
    reason: mockUnknownReason,
    authority: { kind: "product_policy", note: "Dealenz product judgment" },
    evaluatedAt: "2024-01-01T00:00:00Z",
  },
  {
    ruleKey: "freelance-fee-terms-missing",
    ruleVersion: "v1",
    status: "PASS",
    reason: 'Checked "Freelance fee terms missing": condition absent.',
    authority: { kind: "product_policy", note: "Dealenz product judgment" },
    evaluatedAt: "2024-01-01T00:00:00Z",
  },
]

describe("deriveOpenItems", () => {
  it("creates open items from FAIL findings", () => {
    const result = deriveOpenItems(mockRuleResults)
    
    expect(result.items).toHaveLength(3) // 2 FAIL + 1 UNKNOWN
    expect(result.counts.total).toBe(3)
    expect(result.counts.critical).toBe(1)
    expect(result.counts.material).toBe(0)
    expect(result.counts.attention).toBe(1)
    expect(result.counts.informational).toBe(1)
  })

  it("does not create open items from PASS findings", () => {
    const passOnlyResults = mockRuleResults.filter(r => r.status === "PASS")
    const result = deriveOpenItems(passOnlyResults)
    
    expect(result.items).toHaveLength(0)
    expect(result.counts.total).toBe(0)
  })

  it("sorts items by severity: critical > material > attention > informational", () => {
    const result = deriveOpenItems(mockRuleResults)
    
    // First should be critical (unlimited revisions)
    expect(result.items[0].severity).toBe("critical")
    expect(result.items[0].findingId).toBe("freelance-unlimited-revisions")
    
    // Second should be attention (scope vague)
    expect(result.items[1].severity).toBe("attention")
    expect(result.items[1].findingId).toBe("freelance-scope-vague")
    
    // Third should be informational (UNKNOWN)
    expect(result.items[2].severity).toBe("informational")
    expect(result.items[2].findingId).toBe("freelance-termination-missing")
  })

  it("generates action-oriented titles from findings", () => {
    const result = deriveOpenItems(mockRuleResults)
    
    const scopeItem = result.items.find(i => i.findingId === "freelance-scope-vague")
    expect(scopeItem?.title).toContain("Add") // "Add concrete deliverables..."
    
    const revisionItem = result.items.find(i => i.findingId === "freelance-unlimited-revisions")
    expect(revisionItem?.title).toContain("Limit") // "Limit revisions..."
  })

  it("includes evidence references for FAIL findings", () => {
    const result = deriveOpenItems(mockRuleResults)
    
    const scopeItem = result.items.find(i => i.findingId === "freelance-scope-vague")
    expect(scopeItem?.evidence).toBeDefined()
    expect(Array.isArray(scopeItem?.evidence)).toBe(true)
  })

  it("includes guidance from findings", () => {
    const result = deriveOpenItems(mockRuleResults)
    
    const scopeItem = result.items.find(i => i.findingId === "freelance-scope-vague")
    expect(scopeItem?.guidance).toBe("List exactly what will be delivered so scope stays measurable.")
  })

  it("assigns correct categories based on rule keys", () => {
    const result = deriveOpenItems(mockRuleResults)
    
    const scopeItem = result.items.find(i => i.findingId === "freelance-scope-vague")
    expect(scopeItem?.category).toBe("Scope")
    
    const revisionItem = result.items.find(i => i.findingId === "freelance-unlimited-revisions")
    expect(revisionItem?.category).toBe("Revisions")
  })

  it("handles empty results array", () => {
    const result = deriveOpenItems([])
    
    expect(result.items).toHaveLength(0)
    expect(result.counts.total).toBe(0)
  })
})

describe("getOpenItemsFromAudit", () => {
  it("derives open items from audit structured_data", () => {
    const audit = {
      structured_data: {
        deterministicFindings: mockRuleResults,
      },
    }
    
    const result = getOpenItemsFromAudit(audit)
    
    expect(result.items).toHaveLength(3)
    expect(result.counts.total).toBe(3)
  })

  it("handles audit without structured_data", () => {
    const audit = { structured_data: undefined }
    const result = getOpenItemsFromAudit(audit)
    
    expect(result.items).toHaveLength(0)
  })

  it("handles audit without deterministicFindings", () => {
    const audit = { structured_data: { extractedData: {} } }
    const result = getOpenItemsFromAudit(audit)
    
    expect(result.items).toHaveLength(0)
  })
})