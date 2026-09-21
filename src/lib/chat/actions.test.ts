import { describe, it, expect, vi, beforeEach } from "vitest"
import { createDealThread, getThreadMessages, postRichMessage } from "./actions"

const mockGetUser = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => {
      throw new Error("unexpected table access")
    }),
  })),
}))

vi.mock("@/lib/conversation/store", () => ({
  createConversation: vi.fn(async () => ({ id: "conv-1" })),
  listMessages: vi.fn(async () => []),
  addMessage: vi.fn(async () => ({
    id: "msg-1",
    role: "assistant",
    content: "hi",
    metadata: { type: "text", payload: {} },
    created_at: new Date().toISOString(),
  })),
}))

vi.mock("@/lib/deals/home", () => ({
  createHomeDeal: vi.fn(async () => ({ id: "audit-1" })),
}))

beforeEach(() => {
  mockGetUser.mockReset()
})

describe("chat action error contract (no throws across the boundary)", () => {
  it("postRichMessage returns signed-out as data, never throws", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await postRichMessage("t1", { type: "text", payload: {}, content: "hi" })
    expect(res.ok).toBe(false)
    if (res.ok) throw new Error("unreachable")
    expect(res.error).toMatch(/signed in/)
  })

  it("getThreadMessages returns an empty list for signed-out callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await getThreadMessages("t1")
    expect(res).toEqual({ ok: true, messages: [] })
  })

  it("createDealThread returns creation failures as data, never throws", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await createDealThread("some deal text")
    expect(res.ok).toBe(false)
    if (res.ok) throw new Error("unreachable")
    expect(typeof res.error).toBe("string")
    expect(res.error.length).toBeGreaterThan(0)
  })

  it("createDealThread returns ids on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    const res = await createDealThread("some deal text")
    expect(res).toEqual({ ok: true, threadId: "conv-1", auditId: "audit-1" })
  })
})
