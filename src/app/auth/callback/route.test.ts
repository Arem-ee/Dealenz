import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockExchange = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser, exchangeCodeForSession: mockExchange },
  })),
}))

const USER_ID = "00000000-0000-0000-0000-000000000001"

function authedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: "user@example.com",
    email_confirmed_at: "2024-01-01",
    identities: [{ provider: "email", identity_data: { email: "user@example.com" } }],
    ...overrides,
  }
}

function req(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("normal OAuth sign-in", () => {
  it("exchanges a valid code and redirects to an allowlisted next path", async () => {
    mockExchange.mockResolvedValue({ error: null })
    const res = await GET(req("/auth/callback?code=abc&next=/chat"))
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost/chat")
  })

  it("falls back to /dashboard for a malicious next URL", async () => {
    mockExchange.mockResolvedValue({ error: null })
    const res = await GET(req("/auth/callback?code=abc&next=https://evil.example"))
    expect(res.headers.get("location")).toBe("http://localhost/dashboard")
  })

  it("fails closed on invalid/expired codes", async () => {
    mockExchange.mockResolvedValue({ error: { message: "expired" } })
    const res = await GET(req("/auth/callback?code=reused"))
    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth_failed")
  })

  it("fails closed when no code is present", async () => {
    const res = await GET(req("/auth/callback"))
    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth_failed")
  })
})

describe("explicit Google link flow", () => {
  function googleLinkedUser() {
    return authedUser({
      identities: [
        { provider: "email", identity_data: { email: "user@example.com" } },
        { provider: "google", identity_data: { email: "user@example.com", email_verified: true } },
      ],
    })
  }

  it("links successfully and preserves the canonical user id", async () => {
    const before = authedUser()
    mockGetUser.mockResolvedValueOnce({ data: { user: before }, error: null })
    mockExchange.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValueOnce({ data: { user: googleLinkedUser() }, error: null })
    const res = await GET(req("/auth/callback?code=abc&flow=link&next=/settings"))
    expect(res.headers.get("location")).toBe("http://localhost/settings")
  })

  it("rejects unauthenticated linking attempts", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await GET(req("/auth/callback?code=abc&flow=link"))
    expect(mockExchange).not.toHaveBeenCalled()
    expect(res.headers.get("location")).toBe("http://localhost/settings?error=link_failed")
  })

  it("rejects when the session changes accounts mid-flow", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: authedUser() }, error: null })
    mockExchange.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValueOnce({
      data: { user: authedUser({ id: "00000000-0000-0000-0000-000000000002" }) },
      error: null,
    })
    const res = await GET(req("/auth/callback?code=abc&flow=link"))
    expect(res.headers.get("location")).toBe("http://localhost/settings?error=link_failed")
  })

  it("rejects unverified Google identities", async () => {
    const before = authedUser()
    mockGetUser.mockResolvedValueOnce({ data: { user: before }, error: null })
    mockExchange.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: authedUser({
          identities: [{ provider: "google", identity_data: { email: "other@example.com", email_verified: false } }],
        }),
      },
      error: null,
    })
    const res = await GET(req("/auth/callback?code=abc&flow=link"))
    expect(res.headers.get("location")).toBe("http://localhost/settings?error=link_failed")
  })

  it("returns a generic failure when Google belongs to another account flow", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: authedUser() }, error: null })
    mockExchange.mockResolvedValue({ error: { message: "identity already exists" } })
    const res = await GET(req("/auth/callback?code=abc&flow=link"))
    const location = res.headers.get("location") ?? ""
    expect(location).toBe("http://localhost/settings?error=link_failed")
    expect(location).not.toMatch(/already exists/)
  })
})
