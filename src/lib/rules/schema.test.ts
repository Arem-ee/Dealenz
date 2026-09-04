import { describe, it, expect } from "vitest"
import { checkCondition, parseRule } from "./schema"

function validRuleRaw() {
  return {
    ruleKey: "payment-terms-missing",
    version: 1,
    title: "Payment terms missing",
    description: "Fires when no payment terms were extracted.",
    status: "active",
    priority: 100,
    category: "absence",
    scope: {},
    condition: { field: "facts.budget", op: "missing" },
    fireOn: true,
    finding: { summary: "No payment terms were found.", severity: "attention" as const },
    authority: { kind: "product_policy", note: "Product heuristic, not law." },
  }
}

describe("rule schema", () => {
  it("accepts a valid rule", () => {
    const rule = parseRule(validRuleRaw())
    expect(rule.ruleKey).toBe("payment-terms-missing")
    expect(rule.fireOn).toBe(true)
  })

  it("rejects invalid rules", () => {
    expect(() => parseRule(null)).toThrow()
    expect(() => parseRule({ ...validRuleRaw(), ruleKey: "Bad Key!" })).toThrow(/ruleKey/)
    expect(() => parseRule({ ...validRuleRaw(), title: "" })).toThrow(/title/)
  })

  it("rejects invalid versions", () => {
    expect(() => parseRule({ ...validRuleRaw(), version: 0 })).toThrow(/version/)
    expect(() => parseRule({ ...validRuleRaw(), version: 1.5 })).toThrow(/version/)
  })

  it("rejects invalid conditions", () => {
    expect(() => parseRule({ ...validRuleRaw(), condition: { field: "facts.x", op: "explode" } })).toThrow(/comparison op/)
    expect(() => parseRule({ ...validRuleRaw(), condition: { all: [] } })).toThrow(/1-20/)
    expect(() => parseRule({ ...validRuleRaw(), condition: "always" })).toThrow(/object/)
  })

  it("requires authority and provenance honesty", () => {
    expect(() => parseRule({ ...validRuleRaw(), authority: { kind: "law" } })).toThrow(/authority/)
    expect(() => parseRule({ ...validRuleRaw(), authority: { kind: "product_policy" } })).toThrow(/note/)
    expect(() => parseRule({ ...validRuleRaw(), authority: { kind: "knowledge" } })).toThrow(/itemKey/)
    const withRef = parseRule({
      ...validRuleRaw(),
      authority: { kind: "knowledge", itemKey: "test-statute-a", version: 2 },
    })
    expect(withRef.authority).toEqual({ kind: "knowledge", itemKey: "test-statute-a", version: 2, note: undefined })
  })

  it("rejects invalid scope and status", () => {
    expect(() => parseRule({ ...validRuleRaw(), status: "live" })).toThrow(/status/)
    expect(() => parseRule({ ...validRuleRaw(), category: "vibes" })).toThrow(/category/)
    expect(() => parseRule({ ...validRuleRaw(), scope: { operations: "everything" } })).toThrow(/scope/)
  })

  it("rejects executable payloads and prototype traversal", () => {
    expect(() =>
      parseRule({ ...validRuleRaw(), condition: { field: "facts.x", op: "eq", value: "() => 1" } })
    ).toThrow(/code-like/)
    expect(() =>
      checkCondition({ field: "facts.__proto__.x", op: "exists" } as unknown)
    ).toThrow(/prototypes/)
    expect(() =>
      checkCondition({ field: "facts.x", op: "eq", value: (() => 1) as unknown } as unknown)
    ).toThrow(/functions/)
  })
})
