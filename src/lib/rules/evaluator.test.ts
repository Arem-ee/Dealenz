import { describe, it, expect, vi } from "vitest"
import { evaluateCondition } from "./evaluator"
import { evaluateRule, type RuleResult } from "./result"
import type { RuleInput } from "./schema"
import { testRule, testRuleInput } from "./test-helpers"

describe("rule evaluation", () => {
  it("returns PASS when the risk condition is absent", () => {
    const rule = testRule({
      condition: { field: "facts.budget", op: "missing" },
      fireOn: true,
    })
    const result = evaluateRule(rule, testRuleInput())
    expect(result.status).toBe("PASS")
    expect(result.finding).toBeUndefined()
    expect(result.ruleVersion).toBe("v1")
  })

  it("returns FAIL with a finding when the condition fires", () => {
    const rule = testRule({
      ruleKey: "budget-missing",
      condition: { field: "facts.budget", op: "missing" },
      fireOn: true,
      finding: { summary: "No budget found.", severity: "attention" },
    })
    const input = testRuleInput({ facts: { budget: null } })
    const result = evaluateRule(rule, input)
    expect(result.status).toBe("FAIL")
    expect(result.finding?.summary).toBe("No budget found.")
    expect(result.finding?.severity).toBe("attention")
    expect(result.finding?.authority.kind).toBe("product_policy")
  })

  it("returns UNKNOWN for missing input with a reason", () => {
    const rule = testRule({
      condition: { field: "facts.budget", op: "eq", value: "$5000" },
      fireOn: false,
    })
    const result = evaluateRule(rule, testRuleInput({ facts: {} }))
    expect(result.status).toBe("UNKNOWN")
    expect(result.finding).toBeUndefined()
    expect(result.reason).toMatch(/facts\.budget/)
  })

  it("rejects malformed evaluatedAt explicitly", () => {
    expect(() => evaluateRule(testRule(), testRuleInput({ evaluatedAt: "soon" }))).toThrow(/evaluatedAt/)
  })

  it("is deterministic across repeated evaluations", () => {
    const rule = testRule()
    const input = testRuleInput()
    const first: RuleResult = evaluateRule(rule, input)
    const second: RuleResult = evaluateRule(rule, JSON.parse(JSON.stringify(input)) as RuleInput)
    expect(second).toEqual(first)
  })

  it("makes no network or LLM calls", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    try {
      evaluateRule(testRule(), testRuleInput())
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it("treats fireOn false as PASS-on-true semantics", () => {
    const rule = testRule({ condition: { field: "facts.budget", op: "exists" }, fireOn: false })
    expect(evaluateRule(rule, testRuleInput()).status).toBe("PASS")
    expect(evaluateRule(rule, testRuleInput({ facts: {} })).status).toBe("FAIL")
  })
})

describe("conditions", () => {
  const input = () => testRuleInput()

  it("supports AND with unknown propagation", () => {
    const both = evaluateCondition(input(), {
      all: [
        { field: "facts.budget", op: "exists" },
        { field: "facts.timeline", op: "exists" },
      ],
    })
    expect(both.outcome).toBe(true)
    const partial = evaluateCondition(input(), {
      all: [
        { field: "facts.budget", op: "exists" },
        { field: "facts.absent", op: "eq", value: 1 },
      ],
    })
    expect(partial.outcome).toBe("unknown")
    expect(partial.unknownPaths).toContain("facts.absent")
    const failing = evaluateCondition(input(), {
      all: [
        { field: "facts.budget", op: "missing" },
        { field: "facts.absent", op: "eq", value: 1 },
      ],
    })
    expect(failing.outcome).toBe(false)
  })

  it("supports OR with unknown propagation", () => {
    expect(
      evaluateCondition(input(), { any: [{ field: "facts.nope", op: "missing" }, { field: "facts.budget", op: "exists" }] }).outcome
    ).toBe(true)
    expect(
      evaluateCondition(input(), { any: [{ field: "facts.absent", op: "eq", value: 1 }, { field: "facts.budget", op: "missing" }] }).outcome
    ).toBe("unknown")
  })

  it("supports NOT including nested composition", () => {
    expect(evaluateCondition(input(), { not: { field: "facts.budget", op: "missing" } }).outcome).toBe(true)
    expect(
      evaluateCondition(input(), { not: { all: [{ field: "facts.budget", op: "exists" }, { field: "facts.timeline", op: "exists" }] } }).outcome
    ).toBe(false)
    expect(evaluateCondition(input(), { not: { field: "facts.absent", op: "eq", value: 1 } }).outcome).toBe("unknown")
  })

  it("supports comparisons, membership, and containment", () => {
    expect(evaluateCondition(input(), { field: "facts.confidence", op: "gte", value: 0.5 }).outcome).toBe(true)
    expect(evaluateCondition(input(), { field: "facts.confidence", op: "lt", value: 0.5 }).outcome).toBe(false)
    expect(evaluateCondition(input(), { field: "operation", op: "in", value: ["document_analysis"] }).outcome).toBe(true)
    expect(evaluateCondition(input(), { field: "facts.deliverables", op: "contains", value: "site" }).outcome).toBe(true)
    expect(evaluateCondition(input(), { field: "facts.confidence", op: "gt", value: "high" }).outcome).toBe("unknown")
  })

  it("neutralizes prototype traversal to unknown", () => {
    expect(evaluateCondition(input(), { field: "facts.__proto__.x", op: "exists" }).outcome).toBe(false)
    expect(
      evaluateCondition(input(), { field: "facts.constructor", op: "eq", value: 1 }).outcome
    ).toBe("unknown")
  })
})
