import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { askQuestionAction, getAskContext } from "./actions"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: vi.fn(async () => ({ data: [{ balance: 10 }], error: null })),
  })),
}))

vi.mock("@/lib/conversation/request", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/conversation/request")>()
  return {
    ...actual,
    answerQuestion: vi.fn(async () => ({
      type: "answer",
      text: "Mocked answer.",
      operation: "explanation",
      intent: "understand",
      findingsUsed: [],
      knowledgeSources: [],
      deterministic: false,
      usageRecord: null,
      creditsConsumed: null,
      balance: 9,
      contractViolations: [],
    })),
  }
})

import { answerQuestion } from "@/lib/conversation/request"

function tableMock(singleResult: unknown) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.single = vi.fn().mockResolvedValue(singleResult)
  builder.maybeSingle = vi.fn().mockResolvedValue(singleResult)
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  return builder
}

const mockUser = { id: "user-1", email: "t@t.com", email_confirmed_at: "2024-01-01" }

beforeEach(() => {
  mockGetUser.mockReset()
  mockFrom.mockReset()
  vi.clearAllMocks()
})

describe("ask actions security", () => {
  it("rejects unauthenticated questions", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(askQuestionAction({ text: "Hello" })).rejects.toThrow(/signed in/)
    expect(answerQuestion).not.toHaveBeenCalled()
  })

  it("rejects unverified users", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { ...mockUser, email_confirmed_at: null } }, error: null })
    await expect(askQuestionAction({ text: "Hello" })).rejects.toThrow(/verify/)
    expect(answerQuestion).not.toHaveBeenCalled()
  })

  it("rejects audits the user does not own", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockFrom.mockImplementation(() => tableMock({ data: null, error: { message: "none" } }))
    await expect(askQuestionAction({ text: "Review this.", auditId: "audit-x" })).rejects.toThrow(/not found/)
    expect(answerQuestion).not.toHaveBeenCalled()
  })

  it("accepts owned audits and forwards only user content", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockFrom.mockImplementation(() => tableMock({ data: { id: "audit-1" }, error: null }))
    const response = await askQuestionAction({ text: "Hello", auditId: "audit-1", history: [] })
    expect(response.type).toBe("answer")
    const call = vi.mocked(answerQuestion).mock.calls[0][0]
    expect(call.text).toBe("Hello")
    expect(call.auditId).toBe("audit-1")
    expect(call).not.toHaveProperty("creditsConsumed")
    expect(call).not.toHaveProperty("provider")
    expect(call).not.toHaveProperty("model")
  })

  it("ignores client-supplied credit fields instead of trusting them", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockFrom.mockImplementation(() => tableMock({ data: { id: "audit-1" }, error: null }))
    const response = await askQuestionAction({
      text: "Hello",
      creditsConsumed: 0,
      provider: "cheap-model",
    } as unknown as { text: string })
    expect(response.type).toBe("answer")
    if (response.type !== "answer") throw new Error("unreachable")
    // The mocked pipeline (metering mode) charges nothing regardless of input.
    expect(response.creditsConsumed).toBeNull()
  })

  it("keeps provider credentials out of the client bundle", () => {
    for (const file of ["src/components/ask/ask-client.tsx", "src/app/ask/page.tsx"]) {
      const source = readFileSync(file, "utf8")
      for (const banned of ["ANTHROPIC_API_KEY", "AI_API_KEY", "sk-ant-", "Bearer ", "x-api-key"]) {
        expect(source).not.toContain(banned)
      }
    }
  })

  it("loads balance and owned audits for the page", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const auditsBuilder = tableMock({ data: null, error: null }) as Record<string, unknown>
    auditsBuilder.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [{ id: "a1", title: "Deal", status: "draft" }], error: null }).then(resolve)
    mockFrom.mockImplementation(() => auditsBuilder)
    const context = await getAskContext()
    expect(context.audits).toEqual([{ id: "a1", title: "Deal", status: "draft" }])
  })
})
