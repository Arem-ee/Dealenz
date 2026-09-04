import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  detectFindingConflicts,
  evaluateRule,
  ruleApplies,
  selectRelevantFindings,
} from "./result"
import { testRule, testRuleInput } from "./test-helpers"
import { generateNegotiationPoints } from "@/lib/ai/negotiation"

vi.mock("@/lib/ai/client", () => ({
  callAISurface: vi.fn(async () => ({ text: '{"points":["Ask about scope"]}', meta: {} })),
}))

import { callAISurface } from "@/lib/ai/client"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("rule authority", () => {
  it("preserves authority and provenance on results and findings", () => {
    const rule = testRule({
      authority: { kind: "knowledge", itemKey: "test-statute-a", version: 2, note: "Test link." },
      condition: { field: "facts.budget", op: "missing" },
      fireOn: true,
    })
    const result = evaluateRule(rule, testRuleInput({ facts: {} }))
    // facts {} → budget path unknown → missing() on unknown is true → FAIL.
    expect(result.status).toBe("FAIL")
    expect(result.authority).toEqual({ kind: "knowledge", itemKey: "test-statute-a", version: 2, note: "Test link." })
    expect(result.finding?.authority).toEqual(result.authority)
  })

  it("distinguishes product policy from external authority", () => {
    const result = evaluateRule(testRule(), testRuleInput())
    expect(result.authority.kind).toBe("product_policy")
    expect(JSON.stringify(result)).not.toMatch(/statute|regulation|case law/i)
  })
})

describe("context integration", () => {
  it("rules consume the ContextEnvelope directly", () => {
    const rule = testRule({
      ruleKey: "role-known",
      condition: { field: "context.userRole", op: "eq", value: "freelancer" },
      fireOn: false,
    })
    expect(evaluateRule(rule, testRuleInput()).status).toBe("PASS")
  })

  it("unknown context stays unknown instead of passing or failing silently", () => {
    const rule = testRule({
      ruleKey: "industry-check",
      condition: { field: "context.industry", op: "eq", value: "technology" },
      fireOn: false,
    })
    const result = evaluateRule(rule, testRuleInput())
    expect(result.status).toBe("UNKNOWN")
    expect(result.reason).toMatch(/context\.industry/)
  })

  it("confirmed context is read, never mutated", () => {
    const input = testRuleInput()
    const before = JSON.stringify(input.context)
    evaluateRule(testRule(), input)
    expect(JSON.stringify(input.context)).toBe(before)
  })
})

describe("operations", () => {
  it("reuses the existing AIOperation vocabulary", () => {
    expect(ruleApplies(testRule(), "document_analysis", "freelance")).toBe(true)
    expect(ruleApplies(testRule({ scope: { operations: ["conversation"] } }), "document_analysis", "freelance")).toBe(false)
    expect(ruleApplies(testRule({ status: "draft" }), "document_analysis", "freelance")).toBe(false)
    expect(ruleApplies(testRule({ scope: { dealTypes: ["lease"] } }), "document_analysis", "freelance")).toBe(false)
    expect(ruleApplies(testRule({ scope: { dealTypes: ["lease"] } }), "document_analysis", "lease")).toBe(true)
  })
})

describe("intent and objective", () => {
  it("does not let objective change deterministic truth", () => {
    const rule = testRule({ condition: { field: "facts.budget", op: "missing" }, fireOn: true })
    const base = testRuleInput({ facts: {} })
    expect(evaluateRule(rule, base).status).toBe("FAIL")
    expect(evaluateRule(rule, { ...base, objective: "decide_whether_to_accept" }).status).toBe("FAIL")
    expect(evaluateRule(rule, { ...base, intent: "decide" }).status).toBe("FAIL")
  })

  it("retains intent and objective as selection metadata only", () => {
    const results = [evaluateRule(testRule({ condition: { field: "facts.budget", op: "missing" }, fireOn: true }), testRuleInput({ facts: {} }))]
    const selected = selectRelevantFindings(results, { operation: "document_analysis", intent: "decide", objective: "decide_whether_to_accept" })
    expect(selected).toHaveLength(1)
    expect(selected[0].intent).toBe("decide")
    expect(selected[0].objective).toBe("decide_whether_to_accept")
    // Metadata rides along; the finding fact itself is unchanged.
    expect(selected[0].summary).toBe(results[0].finding?.summary)
  })

  it("orders selected findings by severity without scoring", () => {
    const mk = (key: string, severity: "informational" | "critical", field: string) =>
      evaluateRule(
        testRule({ ruleKey: key, condition: { field, op: "missing" }, fireOn: true, finding: { summary: `${key} fired.`, severity } }),
        testRuleInput({ facts: {} })
      )
    const selected = selectRelevantFindings(
      [mk("low-priority", "informational", "facts.a"), mk("high-priority", "critical", "facts.b")],
      { operation: "document_analysis", limit: 5 }
    )
    expect(selected.map((f) => f.ruleKey)).toEqual(["high-priority", "low-priority"])
    expect(selected).not.toHaveProperty("0.score")
  })
})

describe("AI synthesis boundary", () => {
  it("passes deterministic findings into synthesis input without re-deciding them", async () => {
    const results = [
      evaluateRule(testRule({ ruleKey: "budget-missing", condition: { field: "facts.budget", op: "missing" }, fireOn: true }), testRuleInput({ facts: {} })),
    ]
    const findings = selectRelevantFindings(results, { operation: "document_analysis" })
    await generateNegotiationPoints(
      { goals: [], deliverables: [], timeline: null, budget: null, projectType: null, clientSignals: [], missingInformation: [], confidence: 0.9 },
      { overallScore: 70, riskLevel: "Medium", categories: {}, summary: "s", recommendations: [] },
      "authenticated",
      findings
    )
    const call = vi.mocked(callAISurface).mock.calls[0][1]
    const payload = JSON.parse(call.userContent) as { deterministicFindings: Array<{ ruleKey: string; status: string }> }
    expect(payload.deterministicFindings).toEqual([
      expect.objectContaining({ ruleKey: "budget-missing", status: "FAIL" }),
    ])
    // The constitution still governs the prose layer.
    expect(call.systemPrompt).toContain("Dealenz response contract")
  })

  it("detects conflicts when asserted statuses differ from deterministic truth", () => {
    const results = [
      evaluateRule(testRule({ ruleKey: "a-rule", condition: { field: "facts.budget", op: "exists" }, fireOn: false }), testRuleInput()),
    ]
    expect(results[0].status).toBe("PASS")
    expect(detectFindingConflicts(results, [{ ruleKey: "a-rule", assertedStatus: "PASS" }])).toEqual([])
    const conflicts = detectFindingConflicts(results, [{ ruleKey: "a-rule", assertedStatus: "FAIL" }])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatch(/a-rule/)
    expect(
      detectFindingConflicts(results, [{ ruleKey: "ghost-rule", assertedStatus: "PASS" }])[0]
    ).toMatch(/unknown rule/)
  })
})
