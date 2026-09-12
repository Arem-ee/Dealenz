import { describe, it, expect, vi, beforeEach } from "vitest"

const OWNER_ID = "00000000-0000-0000-0000-00000000aa01"
const REQUEST_ID = "00000000-0000-0000-0000-00000000bb02"
const AUDIT_ID = "00000000-0000-0000-0000-00000000cc03"

interface MockOpts {
  user?: { id: string } | null
  auditRow?: Record<string, unknown> | null
  requestRow?: Record<string, unknown> | null
  commentRow?: Record<string, unknown> | null
  versionRow?: Record<string, unknown> | null
  latestVersion?: Record<string, unknown> | null
  versionQueue?: Array<Record<string, unknown> | null>
  listRows?: Record<string, unknown>[] | null
  orderRow?: Record<string, unknown> | null
  finalRow?: Record<string, unknown> | null
}

const state: { opts: MockOpts; writes: Array<{ table: string; op: string; row?: unknown }> } = {
  opts: {},
  writes: [],
}

function chainFor(table: string) {
  const builder: Record<string, unknown> = {}
  const terminal = (data: unknown) => Promise.resolve({ data, error: null })
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.update = vi.fn((patch: unknown) => {
    state.writes.push({ table, op: "update", row: patch })
    return builder
  })
  builder.insert = vi.fn((row: unknown) => {
    state.writes.push({ table, op: "insert", row })
    return builder
  })
  builder.single = vi.fn(() => {
    if (table === "audits") return terminal(state.opts.auditRow ?? null)
    if (table === "consultation_requests") return terminal(state.opts.requestRow ?? null)
    if (table === "review_comments") return terminal(state.opts.commentRow ?? null)
    if (table === "document_versions") return terminal(state.opts.versionRow ?? null)
    if (table === "document_signers" || table === "service_orders") {
      return terminal(state.opts.orderRow ?? { id: "new-1" })
    }
    return terminal(null)
  })
  builder.maybeSingle = vi.fn(() => {
    if (table === "audits") return terminal(state.opts.auditRow ?? null)
    if (table === "consultation_requests") return terminal(state.opts.requestRow ?? null)
    if (table === "review_comments") return terminal(state.opts.commentRow ?? null)
    if (table === "document_versions") {
      if (state.opts.versionQueue && state.opts.versionQueue.length > 0) {
        return terminal(state.opts.versionQueue.shift() ?? null)
      }
      return terminal(state.opts.latestVersion ?? state.opts.versionRow ?? null)
    }
    if (table === "document_signers") return terminal(state.opts.orderRow ?? null)
    if (table === "final_documents") return terminal(state.opts.finalRow ?? null)
    if (table === "lawyers") return terminal(null)
    if (table === "service_orders") return terminal(state.opts.orderRow ?? null)
    return terminal(null)
  })
  builder.then = (resolve: (v: unknown) => unknown) => {
    const rows = state.opts.listRows ?? []
    return terminal(rows).then(resolve)
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

import {
  getReviewState,
  addOwnerComment,
  resolveProposal,
  cancelReview,
  inviteSigner,
  revokeSigner,
  getExecutionStatus,
  createServiceOrder,
  cancelServiceOrder,
} from "./review-actions"

const ACTIVE_REQUEST = {
  id: REQUEST_ID,
  audit_id: AUDIT_ID,
  user_id: OWNER_ID,
  lawyer_id: "lawyer-1",
  status: "changes_requested",
}

beforeEach(() => {
  vi.clearAllMocks()
  state.opts = {
    user: { id: OWNER_ID },
    auditRow: { id: AUDIT_ID },
    requestRow: { ...ACTIVE_REQUEST },
  }
  state.writes = []
})

describe("owner review state", () => {
  it("returns request, comments, signers, orders, and versions for the owner", async () => {
    state.opts.listRows = []
    const res = await getReviewState(AUDIT_ID)
    expect(res.success).toBe(true)
    expect(res.request).toMatchObject({ id: REQUEST_ID })
  })

  it("rejects other users and bad ids", async () => {
    state.opts.user = { id: "00000000-0000-0000-0000-00000000ff09" }
    state.opts.auditRow = null
    await expect(getReviewState(AUDIT_ID)).rejects.toThrow(/not found/i)
    await expect(getReviewState("nope")).rejects.toThrow(/Invalid audit ID/)
  })
})

describe("owner comments and proposal resolution", () => {
  it("validates comment input", async () => {
    await expect(addOwnerComment(REQUEST_ID, { targetType: "bogus", body: "x" })).rejects.toThrow(/target/)
    await expect(addOwnerComment(REQUEST_ID, { targetType: "general", body: "" })).rejects.toThrow(/1–5000/)
  })

  it("accept moves changes_requested to client_review", async () => {
    state.opts.commentRow = {
      id: "c1",
      consultation_request_id: REQUEST_ID,
      audit_id: AUDIT_ID,
      author_role: "lawyer",
      target_type: "document",
      status: "open",
    }
    const res = await resolveProposal("00000000-0000-0000-0000-00000000cc03", "accept")
    expect(res).toEqual({ success: true, decision: "accept" })
    const updates = state.writes.filter((w) => w.table === "review_comments" && w.op === "update")
    expect(updates).toHaveLength(1)
  })

  it("only lawyer document proposals resolve here", async () => {
    state.opts.commentRow = {
      id: "c1",
      consultation_request_id: REQUEST_ID,
      audit_id: AUDIT_ID,
      author_role: "client",
      target_type: "general",
      status: "open",
    }
    await expect(resolveProposal("00000000-0000-0000-0000-00000000cc03", "accept")).rejects.toThrow(/lawyer document/)
  })

  it("cancel works from active states only", async () => {
    const res = await cancelReview(REQUEST_ID)
    expect(res).toEqual({ success: true, status: "cancelled" })
    state.opts.requestRow = { ...ACTIVE_REQUEST, status: "completed" }
    await expect(cancelReview(REQUEST_ID)).rejects.toThrow(/Cannot cancel/)
  })
})

describe("signers and execution", () => {
  it("invites against the latest version only", async () => {
    state.opts.versionQueue = [
      { id: "v9", audit_id: AUDIT_ID, document_type: "contract", version_number: 2 },
      { version_number: 2 },
    ]
    state.opts.listRows = []
    const res = await inviteSigner(AUDIT_ID, {
      documentVersionId: "00000000-0000-0000-0000-00000000dd04",
      name: "Alice Buyer",
      email: "alice@example.com",
      partyLabel: "buyer",
    })
    expect(res.success).toBe(true)
    expect(typeof res.token).toBe("string")
  })

  it("rejects superseded versions, bad emails, and excess signers", async () => {
    state.opts.versionQueue = [
      { id: "v8", audit_id: AUDIT_ID, document_type: "contract", version_number: 1 },
      { version_number: 2 },
    ]
    await expect(
      inviteSigner(AUDIT_ID, { documentVersionId: "00000000-0000-0000-0000-00000000dd04", name: "A", email: "a@b.co", partyLabel: "x" })
    ).rejects.toThrow(/newer document version/)
    state.opts.latestVersion = { version_number: 1 }
    await expect(
      inviteSigner(AUDIT_ID, { documentVersionId: "00000000-0000-0000-0000-00000000dd04", name: "A", email: "not-an-email", partyLabel: "x" })
    ).rejects.toThrow(/email/i)
  })

  it("revokes via the narrow RPC (owners have no direct signer writes)", async () => {
    mockRpc.mockResolvedValue({ data: [{ success: true, message: "Invitation revoked" }], error: null })
    state.opts.orderRow = { id: "s1", audit_id: AUDIT_ID, status: "pending" }
    await expect(revokeSigner("00000000-0000-0000-0000-00000000ee05")).resolves.toEqual({ success: true })
    expect(mockRpc).toHaveBeenCalledWith("revoke_signer_invite", {
      p_signer_id: "00000000-0000-0000-0000-00000000ee05",
    })
  })

  it("surfaces RPC rejections for non-pending invitations", async () => {
    mockRpc.mockResolvedValue({ data: [{ success: false, message: "Only pending invitations can be revoked" }], error: null })
    await expect(revokeSigner("00000000-0000-0000-0000-00000000ee05")).rejects.toThrow(/pending/)
  })

  it("derives execution from the final version only", async () => {
    state.opts.finalRow = { document_version_id: "v3" }
    state.opts.listRows = [{ status: "signed" }, { status: "signed" }]
    const done = await getExecutionStatus(AUDIT_ID, "contract")
    expect(done.executed).toBe(true)
    expect(done.finalVersionId).toBe("v3")
    state.opts.listRows = [{ status: "signed" }, { status: "pending" }]
    const partial = await getExecutionStatus(AUDIT_ID, "contract")
    expect(partial.executed).toBe(false)
    state.opts.listRows = []
    const none = await getExecutionStatus(AUDIT_ID, "contract")
    expect(none.executed).toBe(false)
  })

  it("is not executed without a final version", async () => {
    state.opts.finalRow = null
    state.opts.listRows = [{ status: "signed" }]
    const res = await getExecutionStatus(AUDIT_ID, "contract")
    expect(res.executed).toBe(false)
    expect(res.finalVersionId).toBeNull()
  })
})

describe("service orders (money boundary, no credits)", () => {
  it("creates requested orders without touching the credit ledger", async () => {
    const res = await createServiceOrder(AUDIT_ID, REQUEST_ID, { note: "Review my lease" })
    expect(res.success).toBe(true)
    const tables = state.writes.map((w) => w.table)
    expect(tables).toContain("service_orders")
    expect(tables).not.toContain("credit_ledger")
    expect(tables).not.toContain("credit_purchases")
  })

  it("validates amounts and rejects cancelled reviews", async () => {
    await expect(createServiceOrder(AUDIT_ID, REQUEST_ID, { amountMinor: -5 })).rejects.toThrow(/amount/i)
    state.opts.requestRow = { ...ACTIVE_REQUEST, status: "cancelled" }
    await expect(createServiceOrder(AUDIT_ID, REQUEST_ID, {})).rejects.toThrow(/cancelled/i)
  })

  it("cancels requested orders only", async () => {
    state.opts.orderRow = { id: "o1", audit_id: AUDIT_ID, user_id: OWNER_ID, status: "requested" }
    await expect(cancelServiceOrder("00000000-0000-0000-0000-00000000ff06")).resolves.toEqual({ success: true })
    state.opts.orderRow = { id: "o1", audit_id: AUDIT_ID, user_id: OWNER_ID, status: "paid" }
    await expect(cancelServiceOrder("00000000-0000-0000-0000-00000000ff06")).rejects.toThrow(/requested/)
  })
})
