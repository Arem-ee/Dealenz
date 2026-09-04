import { describe, it, expect, vi } from "vitest"
import {
  answerQuestion,
  classifyOperation,
  inferIntent,
  selectFindingsForIntent,
  type ConversationPorts,
} from "./request"
import { applyUserConfirmation, seedEnvelopeForDealType } from "@/lib/context"
import type { CreditPolicy } from "@/lib/ai/usage"

function envelope() {
  return applyUserConfirmation(seedEnvelopeForDealType("freelance"), {
    userRole: { value: "freelancer" },
    counterpartyRole: { value: "client" },
  })
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
    expect(response.usageRecord.operation).toBe("explanation")
    expect(response.usageRecord.inputTokens).toBe(50)
    expect(response.usageRecord.totalTokens).toBe(60)
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

  it("releases no hold and records failure distinctly on AI failure in metering mode", async () => {
    const { ports, aiCalls, ledger } = fakePorts()
    ports.aiCaller = async () => { throw new Error("provider down") }
    await expect(answerQuestion({ text: "Hello", userId: "u1", ports })).rejects.toThrow("provider down")
    expect(aiCalls).toHaveLength(0)
    expect(ledger.calls.some((c) => c.fn === "void_reservation")).toBe(false)
  })

  it("selects findings by intent deterministically", () => {
    const findings = [
      { ruleKey: "a", ruleVersion: 1, summary: "Info.", severity: "informational" as const, authority: { kind: "product_policy" as const, note: "n" } },
      { ruleKey: "b", ruleVersion: 1, summary: "Bad.", severity: "material" as const, guidance: "Fix it.", authority: { kind: "product_policy" as const, note: "n" } },
    ]
    expect(selectFindingsForIntent(findings, "decide", 5).map((f) => f.ruleKey)).toEqual(["b", "a"])
    expect(selectFindingsForIntent(findings, "negotiate", 5).map((f) => f.ruleKey)).toEqual(["b", "a"])
  })
})
