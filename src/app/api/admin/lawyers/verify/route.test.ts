import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

const state: {
  lawyerRow: Record<string, unknown> | null
  updateError: { message: string } | null
  writes: Array<{ table: string; op: string }>
  inserts: Array<{ table: string; row: unknown }>
} = { lawyerRow: null, updateError: null, writes: [], inserts: [] }

function chainFor(table: string) {
  const builder: Record<string, unknown> = {}
  let updating = false
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => {
    // Terminal only for the update chain; select chains continue to
    // maybeSingle on the builder itself.
    if (updating && table === "lawyers") {
      if (state.updateError) return Promise.resolve({ data: null, error: state.updateError })
      return Promise.resolve({ data: null, error: null })
    }
    return builder
  })
  builder.maybeSingle = vi.fn(() => {
    if (table === "lawyers") return Promise.resolve({ data: state.lawyerRow, error: null })
    return Promise.resolve({ data: null, error: null })
  })
  builder.update = vi.fn(() => {
    updating = true
    state.writes.push({ table, op: "update" })
    return builder
  })
  builder.insert = vi.fn((row: unknown) => {
    state.writes.push({ table, op: "insert" })
    state.inserts.push({ table, row })
    return Promise.resolve({ data: null, error: null })
  })
  return builder
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => chainFor(table),
  })),
}))

import { POST } from "./route"

const ADMIN_ID = "00000000-0000-0000-0000-000000000001"
const LAWYER_ROW_ID = "00000000-0000-0000-0000-000000000002"

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/lawyers/verify", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

function asAdmin() {
  mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID, app_metadata: { is_admin: true } } } })
}

beforeEach(() => {
  vi.clearAllMocks()
  state.lawyerRow = { id: LAWYER_ROW_ID, user_id: "00000000-0000-0000-0000-000000000003", verification_status: "pending" }
  state.updateError = null
  state.writes = []
  state.inserts = []
})

describe("POST /api/admin/lawyers/verify authorization", () => {
  it("allows a legitimate admin (app_metadata) to verify", async () => {
    asAdmin()
    const res = await POST(req({ lawyer_id: LAWYER_ROW_ID, action: "verify" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, status: "verified" })
  })

  it("rejects forged user_metadata is_admin (self-promotion)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: ADMIN_ID, app_metadata: {}, user_metadata: { is_admin: true } } },
    })
    const res = await POST(req({ lawyer_id: LAWYER_ROW_ID, action: "verify" }))
    expect(res.status).toBe(401)
  })

  it("rejects ordinary users", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID, app_metadata: {} } } })
    const res = await POST(req({ lawyer_id: LAWYER_ROW_ID, action: "verify" }))
    expect(res.status).toBe(401)
  })

  it("rejects unauthenticated callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(req({ lawyer_id: LAWYER_ROW_ID, action: "verify" }))
    expect(res.status).toBe(401)
  })

  it("rejects invalid lawyer_id safely", async () => {
    asAdmin()
    for (const bad of ["not-a-uuid", "", "1'; DROP TABLE lawyers;--", 12345, null]) {
      const res = await POST(req({ lawyer_id: bad, action: "verify" }))
      expect(res.status).toBe(400)
    }
  })

  it("rejects invalid action", async () => {
    asAdmin()
    const res = await POST(req({ lawyer_id: LAWYER_ROW_ID, action: "promote" }))
    expect(res.status).toBe(400)
  })

  it("returns 404 for unknown lawyers without writing", async () => {
    asAdmin()
    state.lawyerRow = null
    const res = await POST(req({ lawyer_id: LAWYER_ROW_ID, action: "verify" }))
    expect(res.status).toBe(404)
    expect(state.writes).toHaveLength(0)
  })
})

describe("governance transitions", () => {
  it("suspends a verified lawyer reversibly", async () => {
    asAdmin()
    state.lawyerRow = { ...state.lawyerRow, verification_status: "verified" }
    const res = await POST(req({ lawyer_id: LAWYER_ROW_ID, action: "suspend" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, status: "suspended" })
  })

  it("refuses to suspend a pending application", async () => {
    asAdmin()
    const res = await POST(req({ lawyer_id: LAWYER_ROW_ID, action: "suspend" }))
    expect(res.status).toBe(409)
    expect(state.writes).toHaveLength(0)
  })

  it("reinstates a suspended lawyer to pending, never straight to verified", async () => {
    asAdmin()
    state.lawyerRow = { ...state.lawyerRow, verification_status: "suspended" }
    const res = await POST(req({ lawyer_id: LAWYER_ROW_ID, action: "reinstate" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, status: "pending" })
  })

  it("refuses direct rejected -> verified approval", async () => {
    asAdmin()
    state.lawyerRow = { ...state.lawyerRow, verification_status: "rejected" }
    const res = await POST(req({ lawyer_id: LAWYER_ROW_ID, action: "verify" }))
    expect(res.status).toBe(409)
    expect(state.writes).toHaveLength(0)
  })

  it("refuses to reject a verified lawyer (suspend is the tool)", async () => {
    asAdmin()
    state.lawyerRow = { ...state.lawyerRow, verification_status: "verified" }
    const res = await POST(req({ lawyer_id: LAWYER_ROW_ID, action: "reject" }))
    expect(res.status).toBe(409)
    expect(state.writes).toHaveLength(0)
  })

  it("records every decision in the audit trail with actor and transition", async () => {
    asAdmin()
    state.lawyerRow = { ...state.lawyerRow, verification_status: "verified" }
    await POST(
      req({
        lawyer_id: LAWYER_ROW_ID,
        action: "suspend",
        verification_source: "admin_review",
        verification_notes: "License expiry under check",
      })
    )
    const events = state.inserts.filter(
      (i) =>
        i.table === "activity_events" &&
        (i.row as Record<string, unknown>)?.event_type === "lawyer_verification_changed"
    )
    expect(events).toHaveLength(1)
    const row = events[0].row as Record<string, unknown>
    expect(row.user_id).toBe(ADMIN_ID)
    const payload = row.payload as Record<string, unknown>
    expect(payload.lawyer_id).toBe(LAWYER_ROW_ID)
    expect(payload.from).toBe("verified")
    expect(payload.to).toBe("suspended")
    expect(payload.source).toBe("admin_review")
  })

  it("bounds record fields instead of storing arbitrary input", async () => {
    asAdmin()
    const res = await POST(
      req({ lawyer_id: LAWYER_ROW_ID, action: "verify", verification_notes: "x".repeat(5000) })
    )
    // Oversized note is dropped, decision still lands.
    expect(res.status).toBe(200)
  })
})
