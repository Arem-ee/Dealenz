import { describe, it, expect, vi, beforeEach } from "vitest"
import { getCounterpartyMemory, linkCounterpartyClient } from "./counterparty-actions"

// Counterparty memory actions: explicit linkage only, own rows only,
// identity never guessed.

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const verifiedUser = { id: "00000000-0000-0000-0000-000000000001", email: "t@t.co", email_confirmed_at: "2024-01-01" }
const AUDIT_ID = "00000000-0000-0000-0000-000000000002"
const CLIENT_ID = "00000000-0000-0000-0000-000000000003"

function chain(data: unknown, onUpdate?: (arg: unknown) => void, onInsert?: (arg: unknown) => void) {
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

describe("counterparty actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: verifiedUser }, error: null })
  })

  it("rejects blank counterparty names without touching the DB", async () => {
    const res = await linkCounterpartyClient(AUDIT_ID, { name: "  " })
    expect(res.ok).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("reuses an existing same-name profile and links the deal", async () => {
    const updates: unknown[] = []
    const inserts: unknown[] = []
    mockFrom.mockImplementation((table: string) => {
      if (table === "audits") return chain({ id: AUDIT_ID }, (arg) => updates.push(arg))
      if (table === "client_profiles") return chain([{ id: CLIENT_ID, name: "Brightline" }], undefined, (arg) => inserts.push(arg))
      return chain(null)
    })
    const res = await linkCounterpartyClient(AUDIT_ID, { name: "brightline" })
    expect(res).toEqual({ ok: true, clientId: CLIENT_ID })
    expect(inserts).toHaveLength(0)
    expect(updates).toHaveLength(1)
    expect((updates[0] as { client_id: string }).client_id).toBe(CLIENT_ID)
  })

  it("reports no identity for unlinked deals", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "audits") return chain({ id: AUDIT_ID, client_id: null })
      return chain(null)
    })
    const res = await getCounterpartyMemory(AUDIT_ID)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.memory.hasIdentity).toBe(false)
      expect(res.memory.pastDeals).toEqual([])
    }
  })

  it("reads prior linked deals with flagged and resolved items", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "audits") {
        // First call in getCounterpartyMemory is the current-audit lookup
        // (maybeSingle); the priors query resolves via the thenable.
        const b = chain({ id: AUDIT_ID, client_id: CLIENT_ID })
        return b
      }
      if (table === "client_profiles") return chain({ name: "Brightline" })
      return chain(null)
    })
    // Route the priors list query (select/order/limit chain without
    // maybeSingle) to history rows by overriding per-call below.
    const priors = [
      {
        id: "00000000-0000-0000-0000-000000000004",
        title: "Old deal",
        deal_type: "freelance",
        status: "analyzed",
        created_at: "2026-01-01",
        structured_data: {
          deterministicFindings: [
            { status: "FAIL", ruleKey: "k", finding: { severity: "material", summary: "Bad term." } },
          ],
          findingDelta: { resolved: [{ ruleKey: "k", summary: "Bad term." }] },
        },
      },
    ]
    let auditsCalls = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === "audits") {
        auditsCalls += 1
        if (auditsCalls === 1) return chain({ id: AUDIT_ID, client_id: CLIENT_ID })
        return chain(priors)
      }
      if (table === "client_profiles") return chain({ name: "Brightline" })
      return chain(null)
    })
    const res = await getCounterpartyMemory(AUDIT_ID)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.memory.hasIdentity).toBe(true)
      expect(res.memory.clientName).toBe("Brightline")
      expect(res.memory.pastDeals).toHaveLength(1)
      expect(res.memory.pastDeals[0].resolved).toEqual([{ ruleKey: "k", summary: "Bad term." }])
    }
  })
})
