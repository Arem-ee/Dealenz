import { describe, it, expect, vi, beforeEach } from "vitest"
import { deleteDeal } from "./actions"

// Per-deal erasure: owner-only, storage first (retryable), then the rows the
// audit-row CASCADE does not cover (conversations, work plans), then the
// audit row itself. Financial ledger rows are never touched. Failures return
// { ok: false } — never throw — so the client always shows the real outcome.
const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockList = vi.hoisted(() => vi.fn())
const mockRemove = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: { from: vi.fn(() => ({ list: mockList, remove: mockRemove })) },
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
  opts: {
    user?: { id: string } | null
    auditRow?: Record<string, unknown> | null
    objects?: Array<{ name: string }>
    deleteErrors?: Record<string, { message: string } | null>
  }
  deletes: Array<{ table: string }>
} = { opts: {}, deletes: [] }

function chainFor(table: string) {
  const builder: Record<string, unknown> = {}
  let isDelete = false
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.delete = vi.fn(() => {
    isDelete = true
    return builder
  })
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => {
    if (table === "audits") return Promise.resolve({ data: state.opts.auditRow ?? null, error: null })
    return Promise.resolve({ data: null, error: null })
  })
  builder.then = (resolve: (v: unknown) => unknown) => {
    if (isDelete) state.deletes.push({ table })
    const err = state.opts.deleteErrors?.[table] ?? null
    return Promise.resolve({ data: null, error: err }).then(resolve)
  }
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  state.opts = {
    user: { id: USER_ID },
    auditRow: { id: AUDIT_ID },
    objects: [{ name: "contract.pdf" }],
    deleteErrors: {},
  }
  state.deletes = []
  mockGetUser.mockResolvedValue({ data: { user: state.opts.user }, error: null })
  mockFrom.mockImplementation((table: string) => chainFor(table))
  mockList.mockResolvedValue({ data: state.opts.objects, error: null })
  mockRemove.mockResolvedValue({ error: null })
})

describe("deleteDeal", () => {
  it("rejects unauthenticated callers without touching anything", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await deleteDeal(AUDIT_ID)
    expect(res).toEqual({ ok: false, error: "Unauthorized" })
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it("rejects malformed ids and missing deals", async () => {
    expect(await deleteDeal("not-a-uuid")).toEqual({ ok: false, error: "Invalid deal" })
    state.opts.auditRow = null
    expect(await deleteDeal(AUDIT_ID)).toEqual({ ok: false, error: "Deal not found" })
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it("removes files, threads, plans, then the audit — owner-scoped throughout", async () => {
    const res = await deleteDeal(AUDIT_ID)
    expect(res).toEqual({ ok: true })
    // Storage prefix is owner-scoped; removal happens before any DB delete.
    expect(mockRemove).toHaveBeenCalledWith([`${USER_ID}/${AUDIT_ID}/contract.pdf`])
    const tables = state.deletes.map((d) => d.table)
    expect(tables).toContain("conversations")
    expect(tables).toContain("work_plans")
    expect(tables).toContain("audits")
    expect(tables.indexOf("conversations")).toBeLessThan(tables.indexOf("audits"))
    expect(tables.indexOf("work_plans")).toBeLessThan(tables.indexOf("audits"))
  })

  it("fails closed when file removal fails, before any DB delete", async () => {
    mockRemove.mockResolvedValue({ error: { message: "boom" } })
    const res = await deleteDeal(AUDIT_ID)
    expect(res.ok).toBe(false)
    expect(state.deletes).toHaveLength(0)
  })

  it("fails closed when a table delete fails", async () => {
    state.opts.deleteErrors = { conversations: { message: "boom" } }
    const res = await deleteDeal(AUDIT_ID)
    expect(res.ok).toBe(false)
    expect(state.deletes.map((d) => d.table)).not.toContain("audits")
  })

  it("proceeds with no files to remove", async () => {
    state.opts.objects = []
    mockList.mockResolvedValue({ data: [], error: null })
    const res = await deleteDeal(AUDIT_ID)
    expect(res).toEqual({ ok: true })
    expect(mockRemove).not.toHaveBeenCalled()
  })
})
