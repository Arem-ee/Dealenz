import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockListUsers = vi.hoisted(() => vi.fn())
const mockTables = vi.hoisted(() => ({
  value: {} as Record<string, unknown[]>,
}))

function tableBuilder(table: string): Record<string, unknown> {
  const b: Record<string, unknown> = {}
  b.select = vi.fn(() => b)
  b.eq = vi.fn(() => b)
  b.order = vi.fn(() => b)
  b.limit = vi.fn(() => Promise.resolve({ data: mockTables.value[table] ?? [], error: null }))
  return b
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { admin: { listUsers: (...args: unknown[]) => mockListUsers(...args) } },
    from: (table: string) => tableBuilder(table),
  })),
}))

import { getActivationStats } from "./actions"

const ADMIN = { id: "00000000-0000-0000-0000-000000000001", app_metadata: { is_admin: true } }
const USER = { id: "00000000-0000-0000-0000-000000000001", app_metadata: {} }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key"
  mockGetUser.mockResolvedValue({ data: { user: ADMIN } })
  mockListUsers.mockResolvedValue({
    data: {
      users: [
        { id: "u1", created_at: new Date(Date.now() - 40 * 86400_000).toISOString() },
        { id: "u2", created_at: new Date(Date.now() - 2 * 86400_000).toISOString() },
      ],
    },
    error: null,
  })
  mockTables.value = {
    audits: [
      { user_id: "u1", status: "analyzed", created_at: new Date(Date.now() - 39 * 86400_000).toISOString() },
      { user_id: "u1", status: "analyzed", created_at: new Date(Date.now() - 38 * 86400_000).toISOString() },
      { user_id: "u2", status: "draft", created_at: new Date(Date.now() - 2 * 86400_000).toISOString() },
    ],
    conversations: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
    credit_purchases: [{ currency: "usd", amount_minor: 999, status: "succeeded" }],
    referral_attributions: [{ status: "pending" }, { status: "rewarded" }],
  }
})

describe("getActivationStats", () => {
  it("aggregates the founder funnel from first-party tables", async () => {
    const res = await getActivationStats()
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error("unreachable")
    expect(res.stats.users).toBe(2)
    expect(res.stats.usersLast30d).toBe(1)
    expect(res.stats.analyzedUsers).toBe(1)
    expect(res.stats.secondAnalysisUsers).toBe(1)
    expect(res.stats.askThreads).toBe(3)
    expect(res.stats.purchasesSucceeded).toBe(1)
    expect(res.stats.revenueMinorByCurrency).toEqual({ USD: 999 })
    expect(res.stats.referralsByStatus).toEqual({ pending: 1, rewarded: 1 })
    expect(res.stats.medianSignupToFirstAnalysisHrs).toBeCloseTo(24, 0)
    expect(res.stats.truncated).toBe(false)
  })

  it("refuses non-admin callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER } })
    const res = await getActivationStats()
    expect(res.ok).toBe(false)
  })
})
