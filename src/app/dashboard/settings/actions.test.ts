import { describe, it, expect, vi, beforeEach } from "vitest"
import { getConnectedProviders, getGoogleLinkPath } from "./actions"

const mockGetUser = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

const mockUser = { id: "00000000-0000-0000-0000-000000000001", email: "test@test.com" }

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getConnectedProviders", () => {
  it("returns linked providers for an authenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { ...mockUser, identities: [{ provider: "email" }, { provider: "google" }] } },
      error: null,
    })
    const result = await getConnectedProviders()
    expect(result.success).toBe(true)
    expect(result.providers).toContain("google")
  })

  it("returns an empty list when no identities are present", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { ...mockUser, identities: [] } }, error: null })
    const result = await getConnectedProviders()
    expect(result.success).toBe(true)
    expect(result.providers).toEqual([])
  })

  it("rejects unauthenticated callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await getConnectedProviders()
    expect(result.success).toBe(false)
  })
})

describe("getGoogleLinkPath", () => {
  it("returns the fixed server-owned link path for authenticated users", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const result = await getGoogleLinkPath()
    expect(result.success).toBe(true)
    expect(result.path).toMatch(/^\/auth\/callback\?flow=link/)
  })

  it("rejects unauthenticated linking attempts", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await getGoogleLinkPath()
    expect(result.success).toBe(false)
    expect(result.path).toBeUndefined()
  })
})
