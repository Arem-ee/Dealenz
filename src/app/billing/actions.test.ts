import { describe, it, expect, vi, beforeEach } from "vitest"
import { getMyReferralCode, getMyReferrals } from "./actions"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: mockFrom,
  })),
}))

const mockUser = { id: "00000000-0000-0000-0000-000000000001", email: "test@test.com" }

function tableMock(rows: unknown[]) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => Promise.resolve({ data: rows, error: null }))
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
})

describe("getMyReferralCode", () => {
  it("returns the server-generated code", async () => {
    mockRpc.mockResolvedValue({ data: [{ code: "ABC123XY" }], error: null })
    const result = await getMyReferralCode()
    expect(result).toEqual({ success: true, code: "ABC123XY" })
    expect(mockRpc).toHaveBeenCalledWith("ensure_referral_code")
  })

  it("rejects unauthenticated callers without touching the RPC", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await getMyReferralCode()
    expect(result.success).toBe(false)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("fails closed when the code is malformed", async () => {
    mockRpc.mockResolvedValue({ data: [{ code: 123 }], error: null })
    const result = await getMyReferralCode()
    expect(result.success).toBe(false)
  })
})

describe("getMyReferrals", () => {
  it("lists only the caller's referred attributions", async () => {
    mockFrom.mockReturnValue(
      tableMock([{ id: "r1", code: "ABC123XY", status: "rewarded", created_at: "2024-01-01", referred_user_id: "u2" }])
    )
    const result = await getMyReferrals()
    expect(result.success).toBe(true)
    expect(result.referrals).toHaveLength(1)
    // Ownership scoping: the query filters by the authenticated user.
    const builder = mockFrom.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>
    expect(builder.eq).toHaveBeenCalledWith("referrer_user_id", mockUser.id)
  })

  it("rejects unauthenticated callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await getMyReferrals()
    expect(result.success).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
