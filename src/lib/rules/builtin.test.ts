import { describe, it, expect, beforeEach } from "vitest"
import { BUILTIN_RULES, registerBuiltinRules, resetBuiltinRegistration } from "./builtin"
import { clearRegistry, evaluateApplicableRules } from "./registry"
import { selectRelevantFindings } from "./result"
import { testRuleInput } from "./test-helpers"

beforeEach(() => {
  clearRegistry()
  resetBuiltinRegistration()
})

describe("built-in rules", () => {
  it("registers a small honest set with product-policy authority", () => {
    expect(BUILTIN_RULES.length).toBeGreaterThanOrEqual(4)
    for (const rule of BUILTIN_RULES) {
      expect(rule.authority.kind).toBe("product_policy")
      expect(JSON.stringify(rule)).not.toContain("—")
    }
    registerBuiltinRules()
    registerBuiltinRules()
  })

  it("fires payment and timeline findings on sparse input", () => {
    registerBuiltinRules()
    const run = evaluateApplicableRules(
      testRuleInput({ facts: { confidence: 0.9 } }),
      "document_analysis",
      "freelance"
    )
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("payment-terms-missing")).toBe("FAIL")
    expect(byKey.get("timeline-missing")).toBe("FAIL")
    // Context in the shared fixture already confirms the counterparty.
    expect(byKey.get("counterparty-unknown")).toBe("PASS")
  })

  it("passes when the facts are present and knowledge matched", () => {
    registerBuiltinRules()
    const run = evaluateApplicableRules(
      {
        ...testRuleInput(),
        knowledge: [
          {
            knowledgeItemId: "k1", itemKey: "k", version: 1, title: "t",
            kind: "market_practice", authority: "market_practice", relevance: 0.8,
            applicabilityReasons: ["r"], effectiveFrom: "2020-01-01", effectiveTo: null,
            sourceName: "s", sourceReference: "r", jurisdiction: "global",
          },
        ],
      },
      "document_analysis",
      "freelance"
    )
    const byKey = new Map(run.results.map((r) => [r.ruleKey, r.status]))
    expect(byKey.get("payment-terms-missing")).toBe("PASS")
    expect(byKey.get("no-curated-knowledge-matched")).toBe("PASS")
    const selected = selectRelevantFindings(run.results, { operation: "document_analysis" })
    expect(selected).toEqual([])
  })

  it("flags cross-border deals without confirmed governing law", () => {
    registerBuiltinRules()
    const find = (run: { results: Array<{ ruleKey: string; status: string }> }) =>
      run.results.find((r) => r.ruleKey === "cross-border-governing-law-unconfirmed")?.status
    // Unresolved cross-border status stays UNKNOWN, never assumed safe.
    expect(find(evaluateApplicableRules(testRuleInput(), "document_analysis", "freelance"))).toBe("UNKNOWN")
    // Confirmed domestic deal: rule stays quiet.
    const domestic = testRuleInput()
    domestic.context.fields.crossBorder = { value: false, source: "user_confirmed", confidence: 1 }
    expect(find(evaluateApplicableRules(domestic, "document_analysis", "freelance"))).toBe("PASS")
    // Confirmed cross-border without governing law: finding fires.
    const crossBorder = testRuleInput()
    crossBorder.context.fields.crossBorder = { value: true, source: "user_confirmed", confidence: 1 }
    expect(find(evaluateApplicableRules(crossBorder, "document_analysis", "freelance"))).toBe("FAIL")
  })

  it("gives every guided builtin finding sendable pushback words", async () => {
    const { BUILTIN_RULES } = await import("./builtin")
    for (const rule of BUILTIN_RULES) {
      if (!rule.finding.guidance) continue
      expect(rule.finding.pushback, rule.ruleKey).toBeDefined()
      expect(rule.finding.pushback!, rule.ruleKey).not.toContain("—")
    }
  })
})
