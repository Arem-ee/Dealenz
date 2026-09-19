import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "./route"

// Credit gate for signature sends (25 credits): same balance check as every
// other billable operation, deducted only when the invite is created.
const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: (...args: unknown[]) => mockRpc(...args),
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
const mockUser = { id: USER_ID, email: "owner@test.com", email_confirmed_at: "2024-01-01" }

const inserts: string[] = []

function tableMock() {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.insert = vi.fn((() => {
    inserts.push("insert")
    return Promise.resolve({ data: null, error: null })
  }) as never)
  builder.maybeSingle = vi.fn(() => {
    // Audits, latest version, version check, owner signer lookup.
    return Promise.resolve({ data: { id: AUDIT_ID, document_type: "proposal" }, error: null })
  })
  return builder
}

function request() {
  return new NextRequest(`http://localhost/api/document/${AUDIT_ID}/invite`, {
    method: "POST",
    body: JSON.stringify({ name: "Counterparty", email: "cp@test.com" }),
  })
}

beforeEach(() => {
  mockGetUser.mockReset()
  mockFrom.mockReset()
  mockRpc.mockReset()
  inserts.length = 0
  mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
  mockFrom.mockImplementation(() => tableMock())
})

describe("invite signature-send credit gate (25 credits)", () => {
  it("denies never-purchased accounts with 402 before creating anything", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "reserve_credits") return Promise.resolve({ data: [{ allowed: false, balance: 10, reservation_id: null }], error: null })
      return Promise.resolve({ data: null, error: null })
    })
    const res = await POST(request(), { params: Promise.resolve({ auditId: AUDIT_ID }) })
    expect(res.status).toBe(402)
    const body = (await res.json()) as { success: boolean; error?: string }
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/Insufficient credits/)
    expect(body.error).toMatch(/25 credits/)
    expect(inserts).toHaveLength(0)
  })

  it("deducts exactly the signature-send price on success", async () => {
    const seen: Array<{ fn: string; args: unknown }> = []
    mockRpc.mockImplementation((fn: string, args: unknown) => {
      seen.push({ fn, args })
      if (fn === "reserve_credits") return Promise.resolve({ data: [{ allowed: true, balance: 100, reservation_id: "res-1" }], error: null })
      if (fn === "finalize_reservation") return Promise.resolve({ data: [{ balance: 75 }], error: null })
      return Promise.resolve({ data: null, error: null })
    })
    const res = await POST(request(), { params: Promise.resolve({ auditId: AUDIT_ID }) })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { success: boolean }).success).toBe(true)
    const reserve = seen.find((s) => s.fn === "reserve_credits")
    expect((reserve?.args as { p_amount?: number }).p_amount).toBe(25)
    const fin = seen.find((s) => s.fn === "finalize_reservation")
    expect((fin?.args as { p_consumption_amount?: number }).p_consumption_amount).toBe(25)
  })
})
