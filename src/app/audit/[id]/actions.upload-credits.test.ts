import { describe, it, expect, vi, beforeEach } from "vitest"
import { attachFileMetadata } from "./actions"

// Credit gate for file upload (15 credits): same balance check as every
// other billable operation, deducted only on successful attach.
const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())
const mockDownload = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: {
      from: () => ({
        download: (...args: unknown[]) => mockDownload(...args),
        remove: async () => ({}),
      }),
    },
  })),
}))

vi.mock("@/lib/logger", () => ({
  logEvent: vi.fn(),
  logDuration: vi.fn(() => 1),
  reportError: vi.fn(),
  reportAIFallback: vi.fn(),
}))

const USER_ID = "00000000-0000-0000-0000-000000000001"
const AUDIT_ID = "00000000-0000-0000-0000-000000000002"
const mockUser = { id: USER_ID, email: "test@test.com", email_confirmed_at: "2024-01-01" }

function fileData() {
  return {
    name: "brief.pdf",
    size: 1000,
    type: "application/pdf",
    path: `audit-files/${USER_ID}/${AUDIT_ID}/brief.pdf`,
  }
}

function tableMock(updateResult: unknown = { data: null, error: null }) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  builder.insert = vi.fn(() => Promise.resolve({ data: null, error: null }))
  builder.single = vi.fn(() => Promise.resolve({ data: { structured_data: {} }, error: null }))
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(updateResult).then(resolve)
  return builder
}

beforeEach(() => {
  mockGetUser.mockReset()
  mockFrom.mockReset()
  mockRpc.mockReset()
  mockDownload.mockReset()
  mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
  mockFrom.mockImplementation(() => tableMock())
  mockDownload.mockResolvedValue({ data: { arrayBuffer: async () => Buffer.from("%PDF-1.4 test content") }, error: null })
})

describe("attachFileMetadata credit gate (15 credits)", () => {
  it("denies never-purchased accounts without touching the database", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "reserve_credits") return Promise.resolve({ data: [{ allowed: false, balance: 10, reservation_id: null }], error: null })
      return Promise.resolve({ data: null, error: null })
    })
    await expect(attachFileMetadata(AUDIT_ID, fileData())).rejects.toThrow(/Insufficient credits/)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("deducts exactly the upload price on success", async () => {
    const seen: Array<{ fn: string; args: unknown }> = []
    mockRpc.mockImplementation((fn: string, args: unknown) => {
      seen.push({ fn, args })
      if (fn === "reserve_credits") return Promise.resolve({ data: [{ allowed: true, balance: 100, reservation_id: "res-1" }], error: null })
      if (fn === "finalize_reservation") return Promise.resolve({ data: [{ balance: 85 }], error: null })
      return Promise.resolve({ data: null, error: null })
    })
    const files = await attachFileMetadata(AUDIT_ID, fileData())
    expect(files).toHaveLength(1)
    const reserve = seen.find((s) => s.fn === "reserve_credits")
    expect((reserve?.args as { p_amount?: number }).p_amount).toBe(15)
    const fin = seen.find((s) => s.fn === "finalize_reservation")
    expect((fin?.args as { p_consumption_amount?: number }).p_consumption_amount).toBe(15)
  })

  it("validates input before touching credits", async () => {
    await expect(attachFileMetadata(AUDIT_ID, { ...fileData(), name: "../evil.pdf" })).rejects.toThrow(/Invalid file name/)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects bytes that do not match the declared type before reserving credits", async () => {
    mockDownload.mockResolvedValue({ data: { arrayBuffer: async () => Buffer.from("just some plain text, not a pdf") }, error: null })
    await expect(attachFileMetadata(AUDIT_ID, fileData())).rejects.toThrow(/does not match/)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
