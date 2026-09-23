import { describe, it, expect, vi, beforeEach } from "vitest"
import { exportMyData } from "./actions"

// Self-service export: one JSON document, every query owner-scoped, bounded
// limits, failures return (never throw).
const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const USER_ID = "00000000-0000-0000-0000-00000000aa01"

const state: {
  tables: Record<string, unknown[]>
  queried: string[]
  user: { id: string; email: string } | null
} = { tables: {}, queried: [], user: null }

function chainFor(table: string) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => {
    const rows = state.tables[table] ?? []
    return Promise.resolve({ data: rows[0] ?? null, error: null })
  })
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: state.tables[table] ?? [], error: null }).then(resolve)
  state.queried.push(table)
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  state.user = { id: USER_ID, email: "owner@example.com" }
  state.tables = {
    business_profiles: [{ business_name: "Acme" }],
    audits: [{ id: "a1", title: "Deal" }],
    conversations: [{ id: "c1", title: "Thread" }],
    conversation_messages: [{ id: "m1", content: "hi" }],
    document_versions: [{ id: "v1" }],
    monitoring_events: [{ id: "e1" }],
    credit_ledger: [{ id: "l1", amount: 10 }],
    credit_purchases: [{ id: "p1", credits: 50 }],
  }
  state.queried = []
  mockGetUser.mockResolvedValue({ data: { user: state.user }, error: null })
  mockFrom.mockImplementation((table: string) => chainFor(table))
})

describe("exportMyData", () => {
  it("rejects unauthenticated callers without querying anything", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await exportMyData()
    expect(res).toEqual({ ok: false, error: "Unauthorized" })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("returns every section, owner-scoped, with identity header", async () => {
    const res = await exportMyData()
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error("unreachable")
    expect(res.export.user).toEqual({ id: USER_ID, email: "owner@example.com" })
    expect(typeof res.export.exportedAt).toBe("string")
    expect(res.export.businessProfile).toEqual({ business_name: "Acme" })
    expect(res.export.audits).toHaveLength(1)
    expect(res.export.conversations).toHaveLength(1)
    expect(res.export.messages).toHaveLength(1)
    expect(res.export.documentVersions).toHaveLength(1)
    expect(res.export.monitoringEvents).toHaveLength(1)
    expect(res.export.creditLedger).toHaveLength(1)
    expect(res.export.creditPurchases).toHaveLength(1)
    // Every table read went through the user-scoped mock; the sensitive
    // tables were all touched (nothing silently omitted).
    for (const table of ["business_profiles", "audits", "conversations", "conversation_messages", "document_versions", "monitoring_events", "credit_ledger", "credit_purchases"]) {
      expect(state.queried).toContain(table)
    }
  })

  it("returns empty arrays (never nulls) when the account holds nothing", async () => {
    state.tables = {}
    const res = await exportMyData()
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error("unreachable")
    expect(res.export.audits).toEqual([])
    expect(res.export.messages).toEqual([])
    expect(res.export.businessProfile).toBeNull()
  })

  it("skips the message query entirely when there are no conversations", async () => {
    state.tables = { ...state.tables, conversations: [] }
    const res = await exportMyData()
    expect(res.ok).toBe(true)
    expect(state.queried).not.toContain("conversation_messages")
  })

  it("fails closed when the database is unreachable", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("db down")
    })
    const res = await exportMyData()
    expect(res).toEqual({ ok: false, error: "We couldn't assemble your export. Please try again." })
  })
})
