import { describe, it, expect, vi, beforeEach } from "vitest"
import { listShareTokens } from "./actions"

// Cross-deal share inventory: owner-scoped twice (RLS policy plus an
// explicit audit-ownership filter), newest first, failures return.
const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

vi.mock("@/lib/logger", () => ({
  logEvent: vi.fn(),
  logDuration: vi.fn(() => 1),
  reportError: vi.fn(),
  reportAIFallback: vi.fn(),
}))

const USER_ID = "00000000-0000-0000-0000-00000000aa01"
const AUDIT_ID = "00000000-0000-0000-0000-00000000aa02"

const state: {
  audits: Array<{ id: string; title: string }>
  tokens: Array<Record<string, unknown>>
  failTokens: boolean
} = { audits: [], tokens: [], failTokens: false }

function chainFor(table: string) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  builder.then = (resolve: (v: unknown) => unknown) => {
    if (table === "audits") return Promise.resolve({ data: state.audits, error: null }).then(resolve)
    if (table === "share_tokens") {
      if (state.failTokens) return Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve)
      return Promise.resolve({ data: state.tokens, error: null }).then(resolve)
    }
    return Promise.resolve({ data: [], error: null }).then(resolve)
  }
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  state.audits = [{ id: AUDIT_ID, title: "Big Deal" }]
  state.tokens = [
    {
      id: "t1",
      audit_id: AUDIT_ID,
      document_type: "report",
      token: "tok-1",
      created_at: "2026-01-02T00:00:00Z",
      expires_at: "2026-02-02T00:00:00Z",
      revoked_at: null,
    },
    {
      id: "t2",
      audit_id: "other-audit",
      document_type: "contract",
      token: "tok-2",
      created_at: "2026-01-01T00:00:00Z",
      expires_at: "2026-02-01T00:00:00Z",
      revoked_at: null,
    },
  ]
  state.failTokens = false
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  mockFrom.mockImplementation((table: string) => chainFor(table))
})

describe("listShareTokens", () => {
  it("rejects unauthenticated callers without querying", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await listShareTokens()).toEqual({ ok: false, error: "Unauthorized" })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("lists owned links with deal titles, dropping rows from audits the caller does not own", async () => {
    const res = await listShareTokens()
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error("unreachable")
    expect(res.links).toHaveLength(1)
    expect(res.links[0]).toMatchObject({
      id: "t1",
      auditId: AUDIT_ID,
      dealTitle: "Big Deal",
      kind: "report",
      token: "tok-1",
    })
  })

  it("returns an empty inventory when the account holds no deals", async () => {
    state.audits = []
    const res = await listShareTokens()
    expect(res).toEqual({ ok: true, links: [] })
  })

  it("fails closed when the token read fails", async () => {
    state.failTokens = true
    const res = await listShareTokens()
    expect(res).toEqual({ ok: false, error: "We couldn't load your shared links. Please try again." })
  })
})
