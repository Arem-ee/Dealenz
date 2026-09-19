import { describe, it, expect, vi, beforeEach } from "vitest"
import { getVaultList, vaultChatAction } from "./actions"

// P0-3: vault paths are pure reads over the caller's own audits — no AI
// calls, no credit movement, no external effects — so they are intentionally
// available before email verification (like dashboard reads and draft
// creation). This test pins that exemption.
const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const unverifiedUser = { id: "user-1", email: "t@t.co", email_confirmed_at: null }

function auditsBuilder(rows: unknown[]) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => Promise.resolve({ data: rows, error: null }))
  return builder
}

beforeEach(() => {
  mockGetUser.mockReset()
  mockFrom.mockReset()
  mockGetUser.mockResolvedValue({ data: { user: unverifiedUser }, error: null })
})

describe("vault actions pre-verification exemption (P0-3)", () => {
  it("serves the vault list to unverified users (own rows only)", async () => {
    mockFrom.mockImplementation(() =>
      auditsBuilder([{ id: "a1", title: "Deal", deal_type: "freelance", status: "done", created_at: "", updated_at: "", overall_score: null, risk_report: null }])
    )
    const rows = await getVaultList()
    expect(rows).toHaveLength(1)
  })

  it("answers vault questions for unverified users without AI", async () => {
    mockFrom.mockImplementation(() => auditsBuilder([]))
    const result = await vaultChatAction({ text: "show my deals" })
    expect(result.ok).toBe(true)
  })
})
