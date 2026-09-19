import { describe, it, expect, vi, beforeEach } from "vitest"
import { analyzeAndPostRisk, generateDocumentAndPost } from "./actions"

// P0-3: chat paths that trigger AI calls and credit consumption require a
// verified email (matching analyzeDeal/generate gates downstream). Thread
// creation, reads, and message writes stay available pre-verification.
const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const unverifiedUser = { id: "00000000-0000-0000-0000-000000000001", email: "t@t.co", email_confirmed_at: null }

beforeEach(() => {
  mockGetUser.mockReset()
  mockFrom.mockReset()
  mockFrom.mockImplementation(() => {
    throw new Error("DB must not be touched before verification")
  })
  mockGetUser.mockResolvedValue({ data: { user: unverifiedUser }, error: null })
})

describe("chat actions email verification (P0-3)", () => {
  it("denies risk analysis posts for unverified users before any AI or DB work", async () => {
    const result = await analyzeAndPostRisk("thread-1", "audit-1")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/verify your email/)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("denies document generation posts for unverified users before any AI or DB work", async () => {
    const result = await generateDocumentAndPost("thread-1", "audit-1")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/verify your email/)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
