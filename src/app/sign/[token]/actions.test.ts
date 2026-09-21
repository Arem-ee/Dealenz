import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mockRpc = vi.hoisted(() => vi.fn())
const mockServiceMaybeSingle = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ rpc: mockRpc })),
}))

// ownerStillPending reads ordering state through the service client:
// counterparty signer row, then the owner row on the same version.
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ in: () => ({ maybeSingle: mockServiceMaybeSingle }), maybeSingle: mockServiceMaybeSingle }),
          in: () => ({ maybeSingle: mockServiceMaybeSingle }),
          maybeSingle: mockServiceMaybeSingle,
        }),
      }),
    }),
  })),
}))

import { getInviteeView, signInviteeDocument, declineInviteeDocument } from "./actions"

const TOKEN = "A1b2C3d4E5f6G7h8I9j0"

function ownerSigned() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key")
  let calls = 0
  mockServiceMaybeSingle.mockImplementation(() => {
    calls += 1
    if (calls % 2 === 1) {
      return Promise.resolve({ data: { audit_id: "audit-1", document_version_id: "v-1", party_label: "counterparty" }, error: null })
    }
    return Promise.resolve({ data: { id: "owner-1", status: "signed" }, error: null })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ownerSigned()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("invitee signing access", () => {
  it("rejects malformed tokens without touching the database", async () => {
    await expect(getInviteeView("")).resolves.toEqual({ found: false })
    await expect(getInviteeView("../escape")).resolves.toEqual({ found: false })
    await expect(signInviteeDocument("x", "A", "a@b.co")).resolves.toMatchObject({ success: false })
    await expect(declineInviteeDocument("")).resolves.toMatchObject({ success: false })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("returns the scoped view for a valid token", async () => {
    mockRpc.mockResolvedValue({
      data: [{
        signer_name: "Alice",
        signer_email: "alice@example.com",
        party_label: "buyer",
        sign_status: "pending",
        signed_at: null,
        document_type: "contract",
        version_number: 3,
        content: "# Contract",
        superseded: false,
      }],
      error: null,
    })
    const res = await getInviteeView(TOKEN)
    expect(res.found).toBe(true)
    expect(res.view?.versionNumber).toBe(3)
    expect(mockRpc).toHaveBeenCalledWith("get_signer_view", { p_token: TOKEN })
  })

  it("exposes execution counts without other signers' identities", async () => {
    mockRpc.mockResolvedValue({
      data: [{
        signer_name: "Alice",
        signer_email: "alice@example.com",
        party_label: "buyer",
        sign_status: "signed",
        signed_at: "2026-01-02T00:00:00.000Z",
        document_type: "contract",
        version_number: 3,
        content: "# Contract",
        superseded: false,
        total_signers: 3,
        signed_signers: 2,
      }],
      error: null,
    })
    const res = await getInviteeView(TOKEN)
    expect(res.view?.totalSigners).toBe(3)
    expect(res.view?.signedSigners).toBe(2)
    // No co-signer names, emails, or deal content beyond this document.
    expect(JSON.stringify(res.view)).not.toContain("Bob")
    expect(JSON.stringify(res.view)).not.toContain("audit")
  })

  it("validates signer identity input before calling the RPC", async () => {
    const badName = await signInviteeDocument(TOKEN, "  ", "a@b.co")
    expect(badName.success).toBe(false)
    const badEmail = await signInviteeDocument(TOKEN, "Alice", "not-an-email")
    expect(badEmail.success).toBe(false)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("signs and declines through the token RPCs", async () => {
    mockRpc.mockResolvedValue({ data: [{ success: true, message: "ok" }], error: null })
    await expect(signInviteeDocument(TOKEN, "Alice", "alice@example.com")).resolves.toEqual({ success: true })
    expect(mockRpc).toHaveBeenCalledWith("sign_as_invitee", expect.objectContaining({ p_token: TOKEN }))
    await expect(declineInviteeDocument(TOKEN)).resolves.toEqual({ success: true })
    expect(mockRpc).toHaveBeenCalledWith("decline_as_invitee", { p_token: TOKEN })
  })

  it("blocks counterparty signing when owner state cannot be verified", async () => {
    mockServiceMaybeSingle.mockReset()
    mockServiceMaybeSingle.mockRejectedValue(new Error("db down"))
    const res = await signInviteeDocument(TOKEN, "Alice", "alice@example.com")
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/owner needs to sign first/i)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("surfaces superseded/duplicate rejections honestly", async () => {
    mockRpc.mockResolvedValue({ data: [{ success: false, message: "A newer document version exists" }], error: null })
    const res = await signInviteeDocument(TOKEN, "Alice", "alice@example.com")
    expect(res).toEqual({ success: false, error: "A newer document version exists" })
  })
})
