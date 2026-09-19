import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  describeFindingDelta,
  detectFindingConflicts,
  deterministicRiskFloor,
  diffFindingSets,
  evaluateRule,
  floorExceedsDisplay,
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

describe("deterministic risk floor (Phase 21 authority boundary)", () => {
  const failWith = (severity: "informational" | "attention" | "material" | "critical") =>
    evaluateRule(
      testRule({
        ruleKey: `floor-${severity}`,
        condition: { field: "facts.budget", op: "missing" },
        fireOn: true,
        finding: { summary: `${severity} fired.`, severity },
      }),
      testRuleInput({ facts: {} })
    )
  const passResult = evaluateRule(
    testRule({ ruleKey: "floor-pass", condition: { field: "facts.budget", op: "missing" }, fireOn: true }),
    testRuleInput()
  )

  it("floors at High when any critical or material FAIL exists", () => {
    expect(passResult.status).toBe("PASS")
    expect(deterministicRiskFloor([passResult, failWith("material")])).toEqual({
      level: "High",
      score: 20,
      severity: "high",
    })
    expect(deterministicRiskFloor([failWith("critical")])).toEqual({
      level: "High",
      score: 20,
      severity: "high",
    })
  })

  it("floors at Medium when only attention FAILs exist", () => {
    expect(deterministicRiskFloor([passResult, failWith("attention")])).toEqual({
      level: "Medium",
      score: 50,
      severity: "medium",
    })
  })

  it("stays Low when nothing worse than informational FAILs exists", () => {
    expect(deterministicRiskFloor([passResult, failWith("informational")])).toEqual({
      level: "Low",
      score: 80,
      severity: "low",
    })
    expect(deterministicRiskFloor([])).toEqual({ level: "Low", score: 80, severity: "low" })
  })

  it("ignores UNKNOWN results instead of converting them into failures", () => {
    const unknown = evaluateRule(
      testRule({ ruleKey: "floor-unknown", condition: { field: "facts.missing", op: "eq", value: "x" }, fireOn: true }),
      testRuleInput({ facts: {} })
    )
    expect(unknown.status).toBe("UNKNOWN")
    expect(deterministicRiskFloor([passResult, unknown])).toEqual({
      level: "Low",
      score: 80,
      severity: "low",
    })
  })

  it("only raises the display, never lowers it", () => {
    expect(floorExceedsDisplay("High", "Low")).toBe(true)
    expect(floorExceedsDisplay("High", "Medium")).toBe(true)
    expect(floorExceedsDisplay("Medium", "Low")).toBe(true)
    expect(floorExceedsDisplay("Medium", "Medium")).toBe(false)
    expect(floorExceedsDisplay("Low", "High")).toBe(false)
    expect(floorExceedsDisplay("High", "critical")).toBe(false)
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

describe("diffFindingSets (redline re-check)", () => {
  const fail = (ruleKey: string, summary = `${ruleKey} summary`) => ({
    ruleKey,
    status: "FAIL" as const,
    finding: { summary, severity: "material" as const },
  })

  it("returns null with no previous FAIL baseline", () => {
    expect(diffFindingSets([], [fail("a")] as never)).toBeNull()
    expect(diffFindingSets(null, [])).toBeNull()
    expect(diffFindingSets(undefined, [])).toBeNull()
  })

  it("splits resolved, still-open, and new issues by ruleKey", () => {
    const delta = diffFindingSets(
      [fail("rent-missing"), fail("termination-missing")],
      [
        { ...fail("termination-missing"), finding: { summary: "still bad", severity: "material" as const } },
        fail("deposit-missing"),
      ] as never
    )
    expect(delta).not.toBeNull()
    expect(delta?.resolved.map((f) => f.ruleKey)).toEqual(["rent-missing"])
    // Still-open carries the current summary, resolved keeps the old one.
    expect(delta?.stillOpen).toEqual([
      expect.objectContaining({ ruleKey: "termination-missing", summary: "still bad" }),
    ])
    expect(delta?.newIssues.map((f) => f.ruleKey)).toEqual(["deposit-missing"])
  })

  it("ignores non-FAIL rows and malformed persisted rows", () => {
    const delta = diffFindingSets(
      [
        fail("a"),
        { ruleKey: "b", status: "PASS" },
        { ruleKey: "c", status: "UNKNOWN" },
        null,
        "nope",
        { status: "FAIL" },
        { ruleKey: "", status: "FAIL", finding: { summary: "x", severity: "material" } },
        { ruleKey: "d", status: "FAIL", finding: { summary: "x", severity: "bogus" } },
      ],
      [fail("a")] as never
    )
    expect(delta?.stillOpen.map((f) => f.ruleKey)).toEqual(["a"])
    expect(delta?.resolved).toEqual([])
    expect(delta?.newIssues).toEqual([])
  })

  it("describes the delta in one honest line", () => {
    const entry = (ruleKey: string) => ({ ruleKey, summary: `${ruleKey} summary`, severity: "material" as const })
    expect(
      describeFindingDelta({ resolved: [entry("a")], stillOpen: [entry("b"), entry("c")], newIssues: [] })
    ).toBe("Re-check complete: 1 resolved, 2 still open, 0 new.")
    expect(describeFindingDelta({ resolved: [], stillOpen: [], newIssues: [] })).toBe(
      "Re-check complete: 0 resolved, 0 still open, 0 new."
    )
  })
})
