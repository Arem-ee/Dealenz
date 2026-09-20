import { describe, it, expect, vi, beforeEach } from "vitest"
import { importInboxThread, listInboxThreads } from "./actions"

// Inbox import: own threads only, explicit per-thread action, dedupe by
// provider thread id, new deals from email bodies. Never bulk, never
// inferred.

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockListThreads = vi.hoisted(() => vi.fn())
const mockGetThread = vi.hoisted(() => vi.fn())
const mockGetMessage = vi.hoisted(() => vi.fn())
const mockCreateConversation = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

vi.mock("./api", () => ({
  listGmailThreads: mockListThreads,
  getGmailThread: mockGetThread,
  getGmailMessage: mockGetMessage,
}))

vi.mock("@/lib/gmail/tokens", () => ({
  getGmailTokens: vi.fn(),
  getValidGmailTokens: vi.fn(),
}))

vi.mock("@/lib/conversation/store", () => ({
  createConversation: mockCreateConversation,
}))

import { getGmailTokens, getValidGmailTokens } from "./tokens"

const verifiedUser = { id: "00000000-0000-0000-0000-000000000001", email: "t@t.co", email_confirmed_at: "2024-01-01" }
const TOKENS = { user_id: verifiedUser.id, access_token: "at", refresh_token: "rt", expiry_date: new Date(Date.now() + 3600000).toISOString() }

function chain(data: unknown, onInsert?: (arg: unknown) => void, onUpdate?: (arg: unknown) => void) {
  const b: Record<string, (...args: unknown[]) => unknown> = {}
  b.select = vi.fn(() => b)
  b.eq = vi.fn(() => b)
  b.neq = vi.fn(() => b)
  b.order = vi.fn(() => b)
  b.limit = vi.fn(() => b)
  b.maybeSingle = vi.fn(() => Promise.resolve({ data, error: null }))
  b.single = vi.fn(() => Promise.resolve({ data, error: null }))
  b.insert = vi.fn((arg: unknown) => {
    onInsert?.(arg)
    return b
  })
  b.update = vi.fn((arg: unknown) => {
    onUpdate?.(arg)
    return b
  })
  b.then = ((resolve: (v: unknown) => unknown) => resolve({ data, error: null })) as unknown as (...args: unknown[]) => unknown
  return b
}

describe("inbox import", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: verifiedUser }, error: null })
    vi.mocked(getGmailTokens).mockResolvedValue(TOKENS as never)
    vi.mocked(getValidGmailTokens).mockResolvedValue(TOKENS as never)
  })

  it("reports unconnected instead of failing when Gmail was never linked", async () => {
    vi.mocked(getGmailTokens).mockResolvedValue(null)
    vi.mocked(getValidGmailTokens).mockResolvedValue(null)
    const res = await listInboxThreads()
    expect(res).toEqual({ ok: true, connected: false })
    expect(mockListThreads).not.toHaveBeenCalled()
  })

  it("lists recent threads with message metadata", async () => {
    mockListThreads.mockResolvedValue({ threads: [{ id: "thr1", snippet: "sn" }], nextPageToken: undefined })
    mockGetThread.mockResolvedValue({ id: "thr1", messageIds: ["m1"] })
    mockGetMessage.mockResolvedValue({ id: "m1", threadId: "thr1", subject: "Contract", from: "them@co.test", date: "Mon", snippet: "sn", bodyText: "terms" })
    const res = await listInboxThreads()
    expect(res.ok).toBe(true)
    if (res.ok && res.connected) {
      expect(res.threads).toEqual([{ threadId: "thr1", subject: "Contract", from: "them@co.test", date: "Mon", snippet: "sn" }])
    } else {
      throw new Error("expected connected list")
    }
  })

  it("rejects invalid thread ids without touching Gmail", async () => {
    const res = await importInboxThread("")
    expect(res.ok).toBe(false)
    expect(mockGetThread).not.toHaveBeenCalled()
  })

  it("returns the existing conversation instead of duplicating", async () => {
    const inserts: unknown[] = []
    mockFrom.mockImplementation((table: string) => {
      if (table === "audits") {
        return chain([{ id: "audit-1", structured_data: { importedGmailThreadId: "thr1" } }], (arg) => inserts.push(arg))
      }
      if (table === "conversations") return chain({ id: "conv-1" })
      return chain(null)
    })
    const res = await importInboxThread("thr1")
    expect(res).toEqual({ ok: true, threadId: "conv-1", duplicate: true })
    expect(inserts).toHaveLength(0)
    expect(mockGetThread).not.toHaveBeenCalled()
  })

  it("creates a generic deal from the thread body with provenance", async () => {
    const inserts: unknown[] = []
    mockFrom.mockImplementation((table: string) => {
      if (table === "audits") {
        const b = chain([{ id: "audit-9", structured_data: {} }], (arg) => inserts.push(arg))
        // dedupe list resolves empty history; insert resolves the new row
        b.then = ((resolve: (v: unknown) => unknown) => resolve({ data: [], error: null })) as unknown as (...args: unknown[]) => unknown
        const rawInsert = b.insert as ReturnType<typeof vi.fn>
        rawInsert.mockImplementation((arg: unknown) => {
          inserts.push(arg)
          return chain({ id: "audit-9" })
        })
        return b
      }
      return chain(null)
    })
    mockGetThread.mockResolvedValue({ id: "thr9", messageIds: ["m9"] })
    mockGetMessage.mockResolvedValue({ id: "m9", threadId: "thr9", subject: "SOW", from: "them@co.test", date: "Tue", snippet: "sn", bodyText: "Work terms here" })
    mockCreateConversation.mockResolvedValue({ id: "conv-9" })
    const res = await importInboxThread("thr9")
    expect(res).toEqual({ ok: true, threadId: "conv-9", duplicate: false })
    const auditInsert = inserts.find((a) => (a as Record<string, unknown>).deal_type === "generic") as Record<string, unknown>
    expect(auditInsert.title).toBe("SOW")
    expect(auditInsert.raw_input as string).toContain("Work terms here")
    expect((auditInsert.structured_data as Record<string, unknown>).importedGmailThreadId).toBe("thr9")
  })
})
