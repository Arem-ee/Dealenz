// Shared builders for rules tests. Not a test file itself.
import { applyUserConfirmation, seedEnvelopeForDealType } from "@/lib/context"
import { parseRule, type Rule, type RuleInput } from "./schema"

export function testRuleInput(overrides: Partial<RuleInput> = {}): RuleInput {
  const envelope = applyUserConfirmation(seedEnvelopeForDealType("freelance"), {
    jurisdiction: { value: "Testlandia" },
    userRole: { value: "freelancer" },
    counterpartyRole: { value: "client" },
  })
  return {
    context: envelope,
    facts: { budget: "$5000", timeline: "2 weeks", deliverables: ["site"], confidence: 0.9 },
    knowledge: [],
    operation: "document_analysis",
    evaluatedAt: "2026-09-04T00:00:00.000Z",
    ...overrides,
  }
}

export function testRule(overrides: Partial<Rule> = {}): Rule {
  return parseRule({
    ruleKey: "test-rule",
    version: 1,
    title: "Test rule",
    description: "Fires for tests.",
    status: "active",
    priority: 50,
    category: "presence",
    scope: {},
    condition: { field: "facts.budget", op: "exists" },
    fireOn: true,
    finding: { summary: "Budget present.", severity: "informational" },
    authority: { kind: "product_policy", note: "Test heuristic." },
    ...overrides,
  })
}
