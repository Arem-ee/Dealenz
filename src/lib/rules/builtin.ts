// Built-in generic rules (Phase 5D).
//
// A small set of real, conservative checks over extracted facts, context, and
// knowledge-candidate presence. Every rule declares product_policy authority
// with an honest note: these are heuristic product checks, not law, and must
// never be presented as legal determinations. No vertical intelligence, no
// legal corpus, no jurisdiction-specific logic lives here.

import { registerRule } from "./registry"
import type { Rule } from "./schema"

const PRODUCT_POLICY_NOTE =
  "Product heuristic, not legal authority. It flags potentially missing information for the user to verify."

export const BUILTIN_RULES: Rule[] = [
  {
    ruleKey: "payment-terms-missing",
    version: 1,
    title: "Payment terms missing",
    description: "Fires when the extracted deal facts contain no payment or money terms.",
    status: "active",
    priority: 100,
    category: "absence",
    scope: {},
    condition: { field: "facts.budget", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No payment terms were found in the deal input.",
      severity: "attention",
      guidance: "Ask how and when you will be paid before accepting.",
    },
    authority: { kind: "product_policy", note: PRODUCT_POLICY_NOTE },
  },
  {
    ruleKey: "timeline-missing",
    version: 1,
    title: "Timeline missing",
    description: "Fires when the extracted deal facts contain no time-bound obligations.",
    status: "active",
    priority: 90,
    category: "absence",
    scope: {},
    condition: { field: "facts.timeline", op: "missing" },
    fireOn: true,
    finding: {
      summary: "No timeline or deadlines were found in the deal input.",
      severity: "informational",
      guidance: "Confirm start dates, milestones, and what happens on delay.",
    },
    authority: { kind: "product_policy", note: PRODUCT_POLICY_NOTE },
  },
  {
    ruleKey: "counterparty-unknown",
    version: 1,
    title: "Counterparty role unknown",
    description: "Fires when the resolved context does not identify the other party role.",
    status: "active",
    priority: 80,
    category: "context",
    scope: {},
    condition: { field: "context.counterpartyRole", op: "missing" },
    fireOn: true,
    finding: {
      summary: "The other party role in this deal is not identified.",
      severity: "attention",
      guidance: "Clarify who the counterparty is and what they owe you.",
    },
    authority: { kind: "product_policy", note: PRODUCT_POLICY_NOTE },
  },
  {
    ruleKey: "cross-border-governing-law-unconfirmed",
    version: 1,
    title: "Cross-border deal without confirmed governing law",
    description: "Fires when cross-border context is present but no governing-law statement was resolved.",
    status: "active",
    priority: 85,
    category: "context",
    scope: {},
    condition: {
      all: [
        { field: "context.crossBorder", op: "eq", value: true },
        { field: "context.governingLaw", op: "missing" },
      ],
    },
    fireOn: true,
    finding: {
      summary: "Cross-border elements are present without a confirmed governing-law statement.",
      severity: "attention",
      guidance: "Ask which law governs the agreement before signing.",
    },
    authority: { kind: "product_policy", note: PRODUCT_POLICY_NOTE },
  },
  {
    ruleKey: "no-curated-knowledge-matched",
    version: 1,
    title: "No curated knowledge matched",
    description: "Fires when the knowledge resolver returned no candidates, marking heuristic analysis.",
    status: "active",
    priority: 10,
    category: "knowledge",
    scope: {},
    condition: { not: { knowledgePresent: {} } },
    fireOn: true,
    finding: {
      summary: "No curated knowledge matched this deal yet, so this analysis is heuristic.",
      severity: "informational",
    },
    authority: { kind: "product_policy", note: PRODUCT_POLICY_NOTE },
  },
  {
    ruleKey: "low-extraction-confidence",
    version: 1,
    title: "Low extraction confidence",
    description: "Fires when extraction confidence falls below the 0.5 validation threshold used by the extraction gate.",
    status: "active",
    priority: 95,
    category: "requirement",
    scope: {},
    condition: { field: "facts.confidence", op: "lt", value: 0.5 },
    fireOn: true,
    finding: {
      summary: "Extraction confidence is low, so details may be unreliable.",
      severity: "attention",
      guidance: "Verify the extracted details against the original input.",
    },
    authority: { kind: "product_policy", note: PRODUCT_POLICY_NOTE },
  },
]

const registered = new Set<string>()

// Idempotent: safe to call at module load and in tests without collisions.
export function registerBuiltinRules(): Rule[] {
  const added: Rule[] = []
  for (const rule of BUILTIN_RULES) {
    const key = `${rule.ruleKey}@v${rule.version}`
    if (registered.has(key)) continue
    registered.add(key)
    try {
      added.push(registerRule(rule))
    } catch {
      // Already registered through another path; registry remains canonical.
    }
  }
  return added
}

export function resetBuiltinRegistration(): void {
  registered.clear()
}
