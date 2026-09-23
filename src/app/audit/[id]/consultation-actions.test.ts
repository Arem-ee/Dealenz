import { describe, it, expect, vi, beforeEach } from "vitest"
import { createConsultationRequest, retryAutoAssignment } from "./consultation-actions"

const USER_ID = "00000000-0000-0000-0000-00000000aa01"
const AUDIT_ID = "00000000-0000-0000-0000-00000000aa02"
const REQUEST_ID = "00000000-0000-0000-0000-00000000aa03"

interface MockOpts {
  user?: { id: string } | null
  auditRow?: Record<string, unknown> | null
  existingRequest?: Record<string, unknown> | null
  verifiedCount?: number
  createdId?: string
  insertError?: { message: string } | null
  rpcOutcome?: { assigned: boolean; lawyer_id: string | null; message: string } | null
  rpcError?: { message: string } | null
  retryRequest?: Record<string, unknown> | null
}

const state: { opts: MockOpts; updates: Array<{ table: string }> } = { opts: {}, updates: [] }

function chainFor(table: string) {
  const builder: Record<string, unknown> = {}
  const terminal = (data: unknown) => Promise.resolve({ data, error: null })
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.insert = vi.fn(() => {
    if (state.opts.insertError) return Promise.resolve({ data: null, error: state.opts.insertError })
    return builder
  })
  builder.update = vi.fn(() => {
    state.updates.push({ table })
    return builder
  })
  builder.single = vi.fn(() => {
    if (table === "audits") return terminal(state.opts.auditRow ?? null)
    if (table === "consultation_requests") return terminal({ id: state.opts.createdId ?? REQUEST_ID })
    return terminal(null)
  })
  builder.maybeSingle = vi.fn(() => {
    if (table === "audits") return terminal(state.opts.auditRow ?? null)
    if (table === "consultation_requests") {
      // First call in createConsultationRequest is the duplicate check;
      // retryAutoAssignment performs its own lookup.
      if (state.opts.retryRequest !== undefined && state.opts.existingRequest === undefined) {
        const row = state.opts.retryRequest
        state.opts.retryRequest = undefined
        return terminal(row)
      }
      return terminal(state.opts.existingRequest ?? null)
    }
    return terminal(null)
  })
  builder.then = (resolve: (v: unknown) => unknown) => {
    if (table === "lawyers") {
      return Promise.resolve({ data: null, error: null, count: state.opts.verifiedCount ?? 0 }).then(resolve)
    }
    return terminal([]).then(resolve)
  }
  return builder
}

const mockRpc = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: state.opts.user ?? null } })) },
    from: (table: string) => chainFor(table),
    rpc: (...args: unknown[]) => mockRpc(...args),
  })),
}))

vi.mock("@/lib/logger", () => ({
  logEvent: vi.fn(),
  logDuration: vi.fn(() => 1),
  reportError: vi.fn(),
  reportAIFallback: vi.fn(),
}))

beforeEach(() => {
  state.opts = {
    user: { id: USER_ID },
    auditRow: { id: AUDIT_ID, user_id: USER_ID },
    verifiedCount: 2,
  }
  state.updates = []
  mockRpc.mockReset()
  // Route ledger RPCs (credit gate) vs matching RPC by function name.
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "reserve_credits") return Promise.resolve({ data: [{ allowed: true, balance: 100, reservation_id: "res-1" }], error: null })
    if (fn === "finalize_reservation") return Promise.resolve({ data: [{ balance: 85 }], error: null })
    if (fn === "void_reservation") return Promise.resolve({ data: null, error: null })
    return Promise.resolve({ data: null, error: null })
  })
})

describe("createConsultationRequest (disabled gate)", () => {
  it("fails closed without touching the database or credits", async () => {
    const res = await createConsultationRequest(AUDIT_ID, "help")
    expect(res.success).toBe(false)
    if (res.success) throw new Error("unreachable")
    expect(res.error).toMatch(/doesn't offer lawyer review/i)
    expect(res.error).toMatch(/No credits were charged/)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("still rejects unauthenticated callers first", async () => {
    state.opts.user = null
    const res = await createConsultationRequest(AUDIT_ID, "help")
    expect(res.success).toBe(false)
    if (res.success) throw new Error("unreachable")
    expect(res.error).toMatch("signed in")
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

describe("retryAutoAssignment", () => {
  it("re-matches an owner request still awaiting assignment", async () => {
    state.opts.retryRequest = { id: REQUEST_ID, audit_id: AUDIT_ID, status: "requested" }
    mockRpc.mockResolvedValue({
      data: [{ assigned: true, lawyer_id: "00000000-0000-0000-0000-00000000bb02", message: "Lawyer assigned automatically" }],
      error: null,
    })
    const res = await retryAutoAssignment(REQUEST_ID)
    expect(res).toEqual({ success: true, status: "matched", autoAssigned: true })
  })

  it("rejects unauthenticated callers without touching the database", async () => {
    state.opts.user = null
    const res = await retryAutoAssignment(REQUEST_ID)
    expect(res.success).toBe(false)
    if (res.success) throw new Error("unreachable")
    expect(res.error).toMatch("signed in")
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("rejects requests the caller does not own", async () => {
    state.opts.retryRequest = null
    const res = await retryAutoAssignment(REQUEST_ID)
    expect(res.success).toBe(false)
    if (res.success) throw new Error("unreachable")
    expect(res.error).toMatch("not found")
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
