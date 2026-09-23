import { describe, it, expect, vi } from "vitest"
import {
  answerQuestion,
  classifyOperation,
  DETERMINISTIC_GREETING,
  inferIntent,
  selectFindingsForIntent,
  type ConversationPorts,
} from "./request"
import { validateOutputContract } from "@/lib/ai/constitution"
import { applyUserConfirmation, emptyContextEnvelope, seedEnvelopeForDealType } from "@/lib/context"
import type { CreditPolicy } from "@/lib/ai/usage"

function envelope() {
  return applyUserConfirmation(seedEnvelopeForDealType("freelance"), {
    userRole: { value: "freelancer" },
    counterpartyRole: { value: "client" },
  })
}

function leaseEnvelope() {
  return applyUserConfirmation(seedEnvelopeForDealType("lease"), {
    userRole: { value: "tenant" },
    counterpartyRole: { value: "landlord" },
  })
}

const SAMPLE_LEASE_EXTRACTED = {
  goals: ["Shop lease"],
  deliverables: [],
  timeline: null,
  budget: null,
  projectType: "lease",
  clientSignals: [],
  missingInformation: [],
  confidence: 0.9,
}

const SAMPLE_EXTRACTED = {
  goals: ["Website"],
  deliverables: ["Site with unlimited revisions"],
  timeline: null,
  budget: null,
  projectType: null,
  clientSignals: [],
  missingInformation: [],
  confidence: 0.9,
}

function fakeLedger(initialBalance = 100) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
  let holds = 0
  const byKey = new Map<string, { allowed: boolean; balance: number; reservation_id: string | null }>()
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown> = {}) => {
    calls.push({ fn, args })
    if (fn === "credit_balance") return { data: [{ balance: initialBalance - holds }], error: null }
    if (fn === "reserve_credits") {
      const key = args.p_idempotency_key as string
      const existing = byKey.get(key)
      if (existing) return { data: [existing], error: null }
      const amount = args.p_amount as number
      if (initialBalance - holds < amount) {
        return { data: [{ allowed: false, balance: initialBalance - holds, reservation_id: null }], error: null }
      }
      holds += amount
      const outcome = { allowed: true, balance: initialBalance - holds, reservation_id: `res-${key}` }
      byKey.set(key, outcome)
      return { data: [outcome], error: null }
    }
    if (fn === "finalize_reservation") {
      const amount = (args.p_consumption_amount as number | null) ?? 0
      holds = Math.max(0, holds - 10)
      void amount
      return { data: [{ balance: initialBalance - holds }], error: null }
    }
    if (fn === "void_reservation") return { data: null, error: null }
    return { data: null, error: { message: "unknown fn" } }
  })
  return { rpc, calls, holds: () => holds }
}

function fakePorts(overrides: Partial<ConversationPorts> = {}) {
  const aiCalls: Array<{ systemPrompt: string; userContent: string; maxTokens: number }> = []
  const ledger = fakeLedger()
  const ports: ConversationPorts = {
    loadContext: async () => envelope(),
    loadFacts: async () => ({ extracted: SAMPLE_EXTRACTED, rawText: "Site with unlimited revisions." }),
    loadKnowledge: async () => [],
    aiCaller: async (req) => {
      aiCalls.push(req)
      return { text: "Short answer.", usage: { inputTokens: 50, outputTokens: 10 }, provider: "anthropic", model: "claude-sonnet-5" }
    },
    ledger: { rpc: ledger.rpc },
    policy: null,
    ...overrides,
  }
  return { ports, aiCalls, ledger }
}

const PRICED: CreditPolicy = {
  estimateMaxCredits: () => 10,
  creditsForUsage: () => 3,
}

describe("operation classification", () => {
  it("routes greetings and simple questions to brief operations", () => {
    expect(classifyOperation("Hello", false)).toBe("conversation")
    expect(classifyOperation("What does net 30 mean?", false)).toBe("explanation")
    expect(classifyOperation("Can I negotiate this?", false)).toBe("negotiation")
    expect(classifyOperation("How do I negotiate a late-payment clause?", false)).toBe("negotiation")
    expect(classifyOperation("How should I respond if a client wants unlimited revisions?", false)).toBe("negotiation")
  })

  it("routes decisions, comparisons, and drafting", () => {
    expect(classifyOperation("Should I accept this?", false)).toBe("decision_support")
    expect(classifyOperation("I have two offers. Which protects me better?", false)).toBe("comparison")
    expect(classifyOperation("Help me respond to this proposal.", false)).toBe("drafting")
    expect(classifyOperation("Review this agreement and tell me the biggest problems.", false)).toBe("document_analysis")
  })

  it("infers intent from the question", () => {
    expect(inferIntent("What does this clause mean?", "explanation")).toBe("understand")
    expect(inferIntent("Should I accept this?", "decision_support")).toBe("decide")
    expect(inferIntent("How do I negotiate this?", "negotiation")).toBe("negotiate")
  })
})

describe("answerQuestion", () => {
  it("answers document-free questions on a brief budget with the constitution applied", async () => {
    const { ports, aiCalls, ledger } = fakePorts()
    const response = await answerQuestion({ text: "What does net 30 mean?", userId: "u1", ports })
    expect(response.type).toBe("answer")
    if (response.type !== "answer") throw new Error("unreachable")
    expect(response.operation).toBe("explanation")
    expect(response.text).toBe("Short answer.")
    expect(aiCalls).toHaveLength(1)
    expect(aiCalls[0].maxTokens).toBe(1024)
    expect(aiCalls[0].systemPrompt).toContain("Dealenz response contract")
    expect(response.usageRecord?.operation).toBe("explanation")
    expect(response.usageRecord?.inputTokens).toBe(50)
    expect(response.usageRecord?.totalTokens).toBe(60)
    expect(response.deterministic).toBe(false)
    // Metering mode: measured but not charged, no reservation taken.
    expect(response.creditsConsumed).toBeNull()
    expect(ledger.calls.some((c) => c.fn === "reserve_credits")).toBe(false)
  })

  it("requires a document for document-analysis operations without calling AI", async () => {
    const { ports, aiCalls, ledger } = fakePorts()
    const response = await answerQuestion({
      text: "Review this agreement and tell me the biggest problems.",
      userId: "u1",
      ports,
    })
    expect(response.type).toBe("needs_document")
    expect(aiCalls).toHaveLength(0)
    expect(ledger.calls).toHaveLength(0)
  })

  it("runs the mixed document plus question flow with findings", async () => {
    const { ports } = fakePorts()
    const response = await answerQuestion({
      text: "Should I accept the payment terms?",
      auditId: "audit-1",
      userId: "u1",
      ports,
    })
    expect(response.type).toBe("answer")
    if (response.type !== "answer") throw new Error("unreachable")
    expect(response.operation).toBe("decision_support")
    expect(response.intent).toBe("decide")
    const keys = response.findingsUsed.map((f) => f.ruleKey)
    expect(keys).toContain("freelance-unlimited-revisions")
    expect(keys.some((k) => k.startsWith("lease-"))).toBe(false)
    expect(response.contractViolations).toEqual([])
  })

  it("prioritizes decision-relevant findings without changing truth", async () => {
    const { ports } = fakePorts()
    const first = await answerQuestion({ text: "Should I accept?", auditId: "a1", userId: "u1", ports })
    const second = await answerQuestion({
      text: "Should I accept?",
      auditId: "a1",
      userId: "u1",
      objective: "decide_whether_to_accept",
      ports,
    })
    expect(first.type).toBe("answer")
    expect(second.type).toBe("answer")
    if (first.type !== "answer" || second.type !== "answer") throw new Error("unreachable")
    const statuses = (r: typeof first) => r.findingsUsed.map((f) => `${f.ruleKey}:${f.summary}`).sort()
    expect(statuses(first)).toEqual(statuses(second))
    expect(first.findingsUsed[0].severity).toBe("material")
  })

  it("repairs a multi-question answer with exactly one retry", async () => {
    const seen: string[] = []
    const { ports } = fakePorts({
      aiCaller: async (req) => {
        seen.push(req.userContent)
        if (seen.length === 1) {
          return {
            text: "Known: the CTO role. Missing: counterparty, pay, vesting. Who is the counterparty? What do they owe? When does it vest?",
            usage: { inputTokens: 50, outputTokens: 40 },
            provider: "anthropic",
            model: "claude-sonnet-5",
          }
        }
        return {
          text: "Known: the CTO role. Who is the counterparty, exactly?",
          usage: { inputTokens: 60, outputTokens: 12 },
          provider: "anthropic",
          model: "claude-sonnet-5",
        }
      },
    })
    const response = await answerQuestion({ text: "Is this offer legit?", auditId: "a1", userId: "u1", ports })
    expect(response.type).toBe("answer")
    if (response.type !== "answer") throw new Error("unreachable")
    expect(seen).toHaveLength(2)
    expect(seen[1]).toMatch(/previous response asked 3 questions/i)
    expect(response.text).toBe("Known: the CTO role. Who is the counterparty, exactly?")
    expect(response.contractViolations).toContain("multi-question-repaired")
  })

  it("accepts the repair when it still asks too much, and records it", async () => {
    let calls = 0
    const { ports } = fakePorts({
      aiCaller: async () => {
        calls++
        return {
          text: "First? Second?",
          usage: { inputTokens: 50, outputTokens: 10 },
          provider: "anthropic",
          model: "claude-sonnet-5",
        }
      },
    })
    const response = await answerQuestion({ text: "Is this offer legit?", auditId: "a1", userId: "u1", ports })
    expect(response.type).toBe("answer")
    if (response.type !== "answer") throw new Error("unreachable")
    // Exactly one repair attempt, then accept: never loop the meter.
    expect(calls).toBe(2)
    expect(response.text).toBe("First? Second?")
    expect(response.contractViolations).toContain("multi-question-accepted")
  })

  it("makes no second call for a single-question answer", async () => {
    let calls = 0
    const { ports } = fakePorts({
      aiCaller: async () => {
        calls++
        return {
          text: "Short answer. Who is the counterparty?",
          usage: { inputTokens: 50, outputTokens: 10 },
          provider: "anthropic",
          model: "claude-sonnet-5",
        }
      },
    })
    const response = await answerQuestion({ text: "Is this offer legit?", userId: "u1", ports })
    expect(response.type).toBe("answer")
    if (response.type !== "answer") throw new Error("unreachable")
    expect(calls).toBe(1)
    expect(response.contractViolations).toEqual([])
  })

  it("denies priced operations without sufficient credits before any AI call", async () => {
    const { ports, aiCalls } = fakePorts()
    ports.policy = PRICED
    ports.ledger = { rpc: fakeLedger(2).rpc }
    const response = await answerQuestion({
      text: "What does net 30 mean?",
      userId: "u1",
      idempotencyKey: "q-1",
      ports,
    })
    expect(response.type).toBe("denied")
    expect(aiCalls).toHaveLength(0)
  })

  it("answers greetings deterministically with no AI call, no ledger, no charge", async () => {
    const { ports, aiCalls, ledger } = fakePorts()
    ports.aiCaller = async () => { throw new Error("must not be called") }
    const response = await answerQuestion({ text: "Hello", userId: "u1", ports })
    expect(response.type).toBe("answer")
    if (response.type !== "answer") throw new Error("unreachable")
    expect(response.text).toBe("Hello. What are you working on?")
    expect(response.deterministic).toBe(true)
    expect(response.usageRecord).toBeNull()
    expect(response.creditsConsumed).toBeNull()
    expect(response.knowledgeSources).toEqual([])
    expect(aiCalls).toHaveLength(0)
    expect(ledger.calls).toHaveLength(0)
  })

  it("releases no hold and records failure distinctly on AI failure in metering mode", async () => {
    const { ports, aiCalls, ledger } = fakePorts()
    ports.aiCaller = async () => { throw new Error("provider down") }
    await expect(answerQuestion({ text: "What does net 30 mean?", userId: "u1", ports })).rejects.toThrow("provider down")
    expect(aiCalls).toHaveLength(0)
    expect(ledger.calls.some((c) => c.fn === "void_reservation")).toBe(false)
  })

  it("bounds history sent to the model and keeps simple answers finding-free", async () => {
    const { ports, aiCalls } = fakePorts()
    const history = Array.from({ length: 10 }, (_, i) => [
      { role: "user" as const, text: `old question ${i}` },
      { role: "assistant" as const, text: `old answer ${i}` },
    ]).flat()
    await answerQuestion({ text: "What does net 30 mean?", userId: "u1", history, ports })
    expect(aiCalls).toHaveLength(1)
    const prompt = aiCalls[0].userContent
    expect(prompt).not.toContain("old question 0")
    expect(prompt).not.toContain("old question 3")
    expect(prompt).toContain("old question 9")
    expect(prompt).toContain("No deterministic findings available")
    expect(prompt).not.toContain("Deterministic findings to reason over")
  })

  it("says how many findings exist when the focused set is truncated", async () => {
    const { ports, aiCalls } = fakePorts({
      loadFacts: async () => ({
        extracted: {
          goals: [],
          deliverables: [],
          timeline: null,
          budget: null,
          projectType: null,
          clientSignals: [],
          missingInformation: [],
          confidence: 0.9,
        },
        rawText: "A vague idea with no terms at all.",
      }),
    })
    const response = await answerQuestion({ text: "What should I watch for?", auditId: "a1", userId: "u1", ports })
    expect(response.type).toBe("answer")
    if (response.type !== "answer") throw new Error("unreachable")
    // Brief budget focuses on 3, but the model is told the true total.
    expect(response.findingsUsed).toHaveLength(3)
    const prompt = aiCalls[0].userContent
    expect(prompt).toMatch(/Focused on the 3 most relevant of \d+ total findings/)
    expect(prompt).toContain("do not infer the content of the others")
  })

  it("keeps the deterministic greeting contract-clean", async () => {
    expect(DETERMINISTIC_GREETING).toBe("Hello. What are you working on?")
    expect(validateOutputContract(DETERMINISTIC_GREETING).passed).toBe(true)
  })

  it("attaches knowledge sources with provenance when resolved", async () => {
    const { ports } = fakePorts()
    ports.loadKnowledge = async () => [
      {
        knowledgeItemId: "k1", itemKey: "test-item", version: 1, title: "Test item",
        kind: "market_practice", authority: "market_practice", relevance: 0.8,
        applicabilityReasons: ["r"], effectiveFrom: "2020-01-01", effectiveTo: null,
        sourceName: "Test Source", sourceReference: "TEST-1", jurisdiction: "global",
      },
    ]
    const response = await answerQuestion({ text: "Should I accept?", auditId: "a1", userId: "u1", ports })
    expect(response.type).toBe("answer")
    if (response.type !== "answer") throw new Error("unreachable")
    expect(response.knowledgeSources).toEqual([
      {
        itemKey: "test-item", title: "Test item", authority: "market_practice",
        sourceName: "Test Source", sourceReference: "TEST-1", jurisdiction: "global",
        effectiveFrom: "2020-01-01",
      },
    ])
  })

  it("selects findings by intent deterministically", () => {
    const findings = [
      { ruleKey: "a", ruleVersion: 1, summary: "Info.", severity: "informational" as const, authority: { kind: "product_policy" as const, note: "n" } },
      { ruleKey: "b", ruleVersion: 1, summary: "Bad.", severity: "material" as const, guidance: "Fix it.", authority: { kind: "product_policy" as const, note: "n" } },
    ]
    expect(selectFindingsForIntent(findings, "decide", 5).map((f) => f.ruleKey)).toEqual(["b", "a"])
    expect(selectFindingsForIntent(findings, "negotiate", 5).map((f) => f.ruleKey)).toEqual(["b", "a"])
  })

  it("answers document-free lease questions without manufacturing a document", async () => {
    const { ports, aiCalls } = fakePorts()
    const response = await answerQuestion({ text: "What does a break clause mean?", userId: "u1", ports })
    expect(response.type).toBe("answer")
    if (response.type !== "answer") throw new Error("unreachable")
    expect(response.operation).toBe("explanation")
    expect(response.findingsUsed).toEqual([])
    expect(response.knowledgeSources).toEqual([])
    expect(aiCalls).toHaveLength(1)
    expect(aiCalls[0].maxTokens).toBe(1024)
    // Narrow lease answers stay under the constitution at brief depth.
    expect(aiCalls[0].systemPrompt).toContain("Dealenz response contract")
    expect(response.text).toBe("Short answer.")
  })

  it("runs mixed lease questions through lease facts and lease rules", async () => {
    const { ports, aiCalls } = fakePorts({
      loadContext: async () => leaseEnvelope(),
      loadFacts: async () => ({
        extracted: SAMPLE_LEASE_EXTRACTED,
        rawText: "12-month shop lease. Tenant liable for all repairs with no cap stated.",
      }),
    })
    const response = await answerQuestion({ text: "Should I accept this lease?", auditId: "lease-1", userId: "u1", ports })
    expect(response.type).toBe("answer")
    if (response.type !== "answer") throw new Error("unreachable")
    const keys = response.findingsUsed.map((f) => f.ruleKey)
    expect(keys).toContain("lease-liability-uncapped")
    expect(keys.some((k) => k.startsWith("freelance-"))).toBe(false)
    for (const finding of response.findingsUsed) {
      expect(finding.authority.kind).toBe("product_policy")
    }
    // Synthesis receives the question, the findings, and the constitution at
    // decision depth — never the whole store, never raw scores.
    expect(aiCalls).toHaveLength(1)
    expect(aiCalls[0].maxTokens).toBe(2048)
    expect(aiCalls[0].systemPrompt).toContain("Dealenz response contract")
    expect(aiCalls[0].userContent).toContain("Should I accept this lease?")
    expect(aiCalls[0].userContent).toContain("Deterministic findings to reason over")
    expect(aiCalls[0].userContent).not.toMatch(/overallScore|dealScore/)
    // Findings used in mixed answers carry their supporting evidence, rooted
    // in the attached audit (not the conversation).
    const flagged = response.findingsUsed.find((f) => f.ruleKey === "lease-liability-uncapped")
    expect(flagged?.evidence?.length).toBeGreaterThan(0)
    expect(flagged?.evidence?.[0].sourceType).toBe("audit_input")
    expect(flagged?.evidence?.[0].sourceId).toBe("lease-1")
    expect(flagged?.evidence?.[0].quote).toMatch(/liab/i)
  })

  it("keeps lease truth identical across intents and objectives", async () => {
    const { ports } = fakePorts({
      loadContext: async () => leaseEnvelope(),
      loadFacts: async () => ({
        extracted: SAMPLE_LEASE_EXTRACTED,
        rawText: "12-month shop lease. No termination clause. No deposit mentioned.",
      }),
    })
    const explore = await answerQuestion({ text: "What should I look for in this lease?", auditId: "lease-1", userId: "u1", ports })
    const decide = await answerQuestion({
      text: "Should I accept this lease?",
      auditId: "lease-1",
      userId: "u1",
      objective: "decide_whether_to_accept",
      ports,
    })
    expect(explore.type).toBe("answer")
    expect(decide.type).toBe("answer")
    if (explore.type !== "answer" || decide.type !== "answer") throw new Error("unreachable")
    const keyset = (r: typeof explore) => r.findingsUsed.map((f) => `${f.ruleKey}:${f.summary}`).sort()
    // Decision intent surfaces a severity-ordered superset; every plain
    // finding appears verbatim in the decision set.
    for (const entry of keyset(explore)) {
      expect(keyset(decide)).toContain(entry)
    }
    expect(decide.findingsUsed[0].severity).toMatch(/material|critical|attention/)
  })

  it("never mutates confirmed context during conversation", async () => {
    const { ports } = fakePorts()
    const stored = envelope()
    const snapshot = JSON.parse(JSON.stringify(stored)) as unknown
    ports.loadContext = async () => stored
    await answerQuestion({ text: "Should I accept?", auditId: "a1", userId: "u1", ports })
    await answerQuestion({ text: "What about payment?", auditId: "a1", userId: "u1", ports })
    expect(stored).toEqual(snapshot)
  })

  it("excludes freelance-scoped rules when the deal type is unknown", async () => {
    const { ports } = fakePorts()
    ports.loadContext = async () => emptyContextEnvelope()
    const response = await answerQuestion({ text: "Should I accept?", auditId: "a1", userId: "u1", ports })
    expect(response.type).toBe("answer")
    if (response.type !== "answer") throw new Error("unreachable")
    const keys = response.findingsUsed.map((f) => f.ruleKey)
    expect(keys.some((k) => k.startsWith("freelance-"))).toBe(false)
    // Unscoped generic rules still evaluate.
    expect(keys).toContain("payment-terms-missing")
  })
})
