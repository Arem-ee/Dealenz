import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}))

import { handleConsultantTurn } from "./handler"
import { createClient } from "@/lib/supabase/server"

const USER_ID = "00000000-0000-0000-0000-000000000001"

function chainForConversation(opts: {
  conversationId?: string
  existingMessages?: Array<{ role: string; content: string; message_type: string }>
}) {
  const convRow = opts.conversationId ? { id: opts.conversationId } : null
  const messages = opts.existingMessages ?? []
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => Promise.resolve({ data: messages, error: null }))
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: convRow, error: null })
  builder.single = vi.fn().mockResolvedValue({ data: { id: "new-audit-id" }, error: null })
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  return builder
}

function ledgerMock() {
  return {
    rpc: vi.fn(async () => ({ data: [{ allowed: true, current_count: 1, balance: 10 }], error: null })),
  } as unknown as import("@/lib/credits/ledger").LedgerClient
}

function aiMock(text: string) {
  return vi.fn(async () => ({ text, usage: undefined, provider: "mock", model: "mock-model" }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID, email_confirmed_at: new Date().toISOString() } } })
  mockRpc.mockResolvedValue({ data: [{ allowed: true }], error: null })
})

describe("consultant handler", () => {
  it("first greeting is deterministic and free, no ai call", async () => {
    mockFrom.mockReturnValue(chainForConversation({}))
    const ai = aiMock("should not be called")
    const result = await handleConsultantTurn({ text: "hello" }, { aiCaller: ai, ledger: ledgerMock(), policy: null })
    expect(result.type).toBe("question")
    if (result.type === "question") expect(result.text).toContain("What are you working on")
    expect(ai).not.toHaveBeenCalled()
  })

  it("free first turn with close out creates a deal and writes envelope intent and priorities", async () => {
    mockFrom.mockReturnValue(chainForConversation({}))
    const aiText = "Great, I have enough.\n{\"decision\": \"create_deal\", \"dealType\": \"founder\", \"intent\": \"review\", \"priorities\": [\"ownership_split\", \"vesting\"], \"jurisdiction\": \"Nigeria\"}"
    const ai = aiMock(aiText)
    const result = await handleConsultantTurn({ text: "me and cofounder splitting equity 50/50 Nigeria" }, { aiCaller: ai, ledger: ledgerMock(), policy: null })
    expect(result.type).toBe("deal_created")
  })

  it("second turn is billed via ledger authorize", async () => {
    mockFrom.mockReturnValue(chainForConversation({ conversationId: "conv-1", existingMessages: [{ role: "user", content: "hi", message_type: "consultation_turn" }] }))
    let authorizeCalled = false
    const ledger = {
      rpc: vi.fn(async (fn: string) => {
        if (fn === "reserve_credits" || fn === "credit_balance") authorizeCalled = true
        return { data: [{ allowed: true, balance: 9 }], error: null } as unknown as { data: unknown; error: null }
      }),
    } as unknown as import("@/lib/credits/ledger").LedgerClient
    const aiText = "Which country?\n{\"decision\": \"answer_directly\", \"reason\": \"test\"}"
    const result = await handleConsultantTurn(
      { text: "my partner sent something", conversationId: "conv-1", idempotencyKey: "k1" },
      { aiCaller: aiMock(aiText), ledger, policy: { estimateMaxCredits: () => 1, creditsForUsage: () => 1 } as unknown as import("@/lib/ai/usage").CreditPolicy }
    )
    expect(authorizeCalled).toBe(true)
    expect(result.type).toBe("answer")
  })

  it("cap denies after 4 user turns", async () => {
    const existing = Array.from({ length: 4 }, (_, i) => ({ role: "user", content: `m${i}`, message_type: "consultation_turn" }))
    mockFrom.mockReturnValue(chainForConversation({ conversationId: "conv-1", existingMessages: existing as never }))
    const result = await handleConsultantTurn({ text: "another", conversationId: "conv-1" }, { aiCaller: aiMock("x"), ledger: ledgerMock(), policy: null })
    expect(result.type).toBe("denied")
  })

  it("document paste creates a deal without ai call", async () => {
    mockFrom.mockReturnValue(chainForConversation({}))
    const longText = "x".repeat(900)
    const ai = aiMock("should not be called")
    const result = await handleConsultantTurn({ text: longText }, { aiCaller: ai, ledger: ledgerMock(), policy: null })
    expect(result.type).toBe("deal_created")
    expect(ai).not.toHaveBeenCalled()
  })
})
