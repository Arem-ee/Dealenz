import { describe, it, expect, vi, beforeEach } from "vitest"
import { createOrganization, inviteOrganizationMember, removeOrganizationMember } from "./actions"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}))

const verifiedUser = { id: "00000000-0000-0000-0000-000000000001", email: "owner@acme.com", email_confirmed_at: "2024-01-01" }

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: verifiedUser }, error: null })
})

describe("organization actions", () => {
  it("rejects bad input without touching the database", async () => {
    expect(await createOrganization("   ")).toEqual({ ok: false, error: expect.any(String) })
    expect(mockRpc).not.toHaveBeenCalled()
    expect(await inviteOrganizationMember("not-a-uuid", "x@y.co", "member")).toEqual({ ok: false, error: expect.any(String) })
    expect(await inviteOrganizationMember("00000000-0000-0000-0000-000000000002", "bad-email", "member")).toEqual({
      ok: false,
      error: expect.any(String),
    })
    expect(await removeOrganizationMember("nope", "00000000-0000-0000-0000-000000000002")).toEqual({
      ok: false,
      error: expect.any(String),
    })
  })

  it("creates organizations through the RPC", async () => {
    mockRpc.mockResolvedValue({ data: [{ id: "00000000-0000-0000-0000-000000000003" }], error: null })
    const res = await createOrganization("Acme Legal")
    expect(res).toEqual({ ok: true, orgId: "00000000-0000-0000-0000-000000000003" })
    expect(mockRpc).toHaveBeenCalledWith("create_organization", { p_name: "Acme Legal" })
  })

  it("requires sign-in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await createOrganization("Acme")).toEqual({ ok: false, error: "You must be signed in." })
  })

  it("surfaces migration-missing RPCs honestly", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function create_organization does not exist' } })
    const res = await createOrganization("Acme")
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/migration 00091/)
  })
})
