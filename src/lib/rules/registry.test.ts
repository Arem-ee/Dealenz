import { describe, it, expect, beforeEach } from "vitest"
import {
  applicableRules,
  clearRegistry,
  evaluateApplicableRules,
  getRegisteredRules,
  registerRule,
} from "./registry"
import { testRule, testRuleInput } from "./test-helpers"

beforeEach(() => {
  clearRegistry()
})

describe("rule registry", () => {
  it("registers validated rules and rejects collisions", () => {
    registerRule(testRule())
    expect(getRegisteredRules()).toHaveLength(1)
    expect(() => registerRule(testRule())).toThrow(/Duplicate/)
    expect(() => registerRule({ ruleKey: "nope" })).toThrow()
  })

  it("discovers rules by status and scope", () => {
    registerRule(testRule({ ruleKey: "global-rule" }))
    registerRule(testRule({ ruleKey: "chat-only", scope: { operations: ["conversation"] } }))
    registerRule(testRule({ ruleKey: "draft-rule", status: "draft" }))
    registerRule(testRule({ ruleKey: "lease-rule", scope: { dealTypes: ["lease"] } }))
    const found = applicableRules("document_analysis", "freelance").map((r) => r.ruleKey)
    expect(found).toContain("global-rule")
    expect(found).not.toContain("chat-only")
    expect(found).not.toContain("draft-rule")
    expect(found).not.toContain("lease-rule")
    expect(applicableRules("conversation", "freelance").map((r) => r.ruleKey)).toContain("chat-only")
  })

  it("evaluates every applicable rule deterministically", () => {
    registerRule(testRule({ ruleKey: "b-rule", priority: 1 }))
    registerRule(testRule({ ruleKey: "a-rule", priority: 99 }))
    const first = evaluateApplicableRules(testRuleInput(), "document_analysis", "freelance")
    const second = evaluateApplicableRules(testRuleInput(), "document_analysis", "freelance")
    expect(first).toEqual(second)
    expect(first.results.map((r) => r.ruleKey)).toEqual(["a-rule", "b-rule"])
    expect(first.evaluatedAt).toBe("2026-09-04T00:00:00.000Z")
  })

  it("runs no network, LLM, or clock reads during evaluation", () => {
    registerRule(testRule())
    const input = testRuleInput()
    const before = JSON.stringify(input)
    evaluateApplicableRules(input, "document_analysis", "freelance")
    expect(JSON.stringify(input)).toBe(before)
  })
})
