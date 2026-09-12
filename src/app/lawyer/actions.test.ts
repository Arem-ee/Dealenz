import { describe, it, expect, vi, beforeEach } from "vitest"

const LAWYER_USER_ID = "00000000-0000-0000-0000-00000000aa01"
const LAWYER_ROW_ID = "00000000-0000-0000-0000-00000000bb02"
const REQUEST_ID = "00000000-0000-0000-0000-00000000cc03"
const AUDIT_ID = "00000000-0000-0000-0000-00000000dd04"

interface MockOpts {
  user?: { id: string; email?: string; app_metadata?: Record<string, unknown> } | null
  lawyerRow?: { id: string; verification_status?: string } | null
  requestRow?: Record<string, unknown> | null
  listRows?: unknown[]
  bundle?: unknown
  versionRows?: unknown
  commentRow?: unknown
  activityRows?: unknown[]
  profileRow?: Record<string, unknown> | null
  orderRows?: unknown[]
}

const state: { opts: MockOpts; writes: Array<{ table: string; op: string }>; inserts: Array<{ table: string; row: unknown }> } = {
  opts: {},
  writes: [],
  inserts: [],
}

function chainFor(table: string) {
  const builder: Record<string, unknown> = {}
  const filters: Array<{ col: string; val: unknown }> = []
  const terminal = (data: unknown) => Promise.resolve({ data, error: null })
  const resolveSelect = () => {
    if (table === "lawyers") {
      const row = (state.opts.lawyerRow ?? null) as Record<string, unknown> | null
      // Faithful server-side filtering: requireVerifiedLawyer constrains
      // verification_status = 'verified' at the source. Fixtures without a
      // status predate the filter and pass through unchanged.
      const statusFilter = filters.find((f) => f.col === "verification_status")
      if (row && statusFilter && row.verification_status !== undefined && row.verification_status !== statusFilter.val) {
        return null
      }
      return row
    }
    if (table === "consultation_requests") {
      if (state.opts.requestRow !== undefined) return state.opts.requestRow
      return null
    }
    return null
  }
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn((col: string, val: unknown) => {
    filters.push({ col, val })
    return builder
  })
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.range = vi.fn(() => builder)
  builder.update = vi.fn((patch: unknown) => {
    state.writes.push({ table, op: "update" })
    void patch
    return builder
  })
  builder.insert = vi.fn((row: unknown) => {
    state.writes.push({ table, op: "insert" })
    state.inserts.push({ table, row })
    return builder
  })
  builder.single = vi.fn(() => terminal(table === "review_comments" ? (state.opts.commentRow ?? { id: "c1" }) : resolveSelect()))
  builder.maybeSingle = vi.fn(() => {
    if (table === "lawyers" && state.opts.profileRow !== undefined) return terminal(state.opts.profileRow)
    return terminal(resolveSelect())
  })
  builder.then = (resolve: (v: unknown) => unknown) => {
    if (table === "consultation_requests" && state.opts.listRows !== undefined) {
      // Faithful server-side filtering: eq() constraints apply at the source.
      const rows = (state.opts.listRows as Array<Record<string, unknown>>).filter((r) =>
        filters.every((f) => r[f.col] === f.val)
      )
      return terminal(rows).then(resolve)
    }
    if (table === "service_orders" && state.opts.orderRows !== undefined) {
      return terminal(state.opts.orderRows).then(resolve)
    }
    return terminal(null).then(resolve)
  }
  return builder
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: state.opts.user ?? null } })) },
    from: (table: string) => chainFor(table),
    rpc: vi.fn((fn: string) => {
      if (fn === "get_lawyer_review_bundle") {
        return Promise.resolve({ data: state.opts.bundle ?? null, error: null })
      }
      if (fn === "lawyer_create_version") {
        return Promise.resolve({ data: state.opts.versionRows ?? [{ version_id: "v1", version_number: 2 }], error: null })
      }
      if (fn === "get_lawyer_activity") {
        return Promise.resolve({ data: state.opts.activityRows ?? [], error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }),
  })),
}))

vi.mock("@/lib/logger", () => ({
  logEvent: vi.fn(),
  logDuration: vi.fn(() => 1),
  reportError: vi.fn(),
  reportAIFallback: vi.fn(),
}))

import {
  listAssignedReviews,
  getAssignedReview,
  acceptReview,
  declineReview,
  beginReview,
  completeReview,
  addLawyerComment,
  proposeChange,
  assignLawyer,
  getLawyerOverview,
  getReviewActivity,
  getReviewServiceOrders,
  getOwnLawyerProfile,
} from "./actions"

const LAWYER_USER = { id: LAWYER_USER_ID }
const ACTIVE_REQUEST = {
  id: REQUEST_ID,
  audit_id: AUDIT_ID,
  user_id: "owner-1",
  lawyer_id: LAWYER_ROW_ID,
  status: "matched",
}

beforeEach(() => {
  vi.clearAllMocks()
  state.opts = { user: LAWYER_USER, lawyerRow: { id: LAWYER_ROW_ID }, requestRow: { ...ACTIVE_REQUEST } }
  state.writes = []
  state.inserts = []
})

describe("lawyer access control", () => {
  it("lists only assigned reviews for verified lawyers", async () => {
    state.opts.listRows = [{ id: REQUEST_ID, audit_id: "a1", lawyer_id: LAWYER_ROW_ID, status: "matched" }]
    const res = await listAssignedReviews()
    expect(res.success).toBe(true)
    expect(res.reviews).toHaveLength(1)
  })

  it("rejects unverified lawyers and anonymous callers", async () => {
    state.opts.lawyerRow = null
    await expect(listAssignedReviews()).rejects.toThrow(/verified lawyer profile/)
    state.opts.user = null
    await expect(listAssignedReviews()).rejects.toThrow(/Unauthorized/)
  })

  it("locks suspended and rejected lawyers out of professional actions", async () => {
    for (const status of ["suspended", "rejected", "pending"]) {
      state.opts.user = LAWYER_USER
      state.opts.lawyerRow = { id: LAWYER_ROW_ID, verification_status: status }
      state.opts.requestRow = { ...ACTIVE_REQUEST }
      await expect(acceptReview(REQUEST_ID)).rejects.toThrow(/verified lawyer profile/)
    }
    // Verified access is unaffected by the filter.
    state.opts.lawyerRow = { id: LAWYER_ROW_ID, verification_status: "verified" }
    const accepted = await acceptReview(REQUEST_ID)
    expect(accepted).toEqual({ success: true, status: "accepted" })
  })

  it("grants bundle access to the assignee on active reviews", async () => {
    state.opts.bundle = { request: { id: REQUEST_ID }, audit: { id: AUDIT_ID } }
    const res = await getAssignedReview(REQUEST_ID)
    expect(res.success).toBe(true)
  })

  it("denies unassigned lawyers, unrelated deals, and terminal reviews", async () => {
    state.opts.requestRow = { ...ACTIVE_REQUEST, lawyer_id: "other-lawyer" }
    await expect(getAssignedReview(REQUEST_ID)).rejects.toThrow(/Not assigned/)
    state.opts.requestRow = { ...ACTIVE_REQUEST, status: "completed" }
    await expect(getAssignedReview(REQUEST_ID)).rejects.toThrow(/revoked/)
    state.opts.requestRow = { ...ACTIVE_REQUEST, status: "cancelled" }
    await expect(addLawyerComment(REQUEST_ID, { targetType: "general", body: "hi" })).rejects.toThrow(/revoked/)
  })

  it("rejects malformed request ids", async () => {
    await expect(getAssignedReview("not-a-uuid")).rejects.toThrow(/Invalid/)
  })
})

describe("lawyer lifecycle transitions", () => {
  it("accept → begin → complete follows the machine", async () => {
    const accepted = await acceptReview(REQUEST_ID)
    expect(accepted).toEqual({ success: true, status: "accepted" })
    state.opts.requestRow = { ...ACTIVE_REQUEST, status: "accepted" }
    const begun = await beginReview(REQUEST_ID)
    expect(begun).toEqual({ success: true, status: "in_progress" })
    state.opts.requestRow = { ...ACTIVE_REQUEST, status: "in_progress" }
    const done = await completeReview(REQUEST_ID)
    expect(done).toEqual({ success: true, status: "completed" })
  })

  it("decline releases the request without deleting history", async () => {
    const res = await declineReview(REQUEST_ID)
    expect(res).toEqual({ success: true, status: "requested" })
  })

  it("decline records the decliner so automatic re-matching never silently re-assigns them", async () => {
    await declineReview(REQUEST_ID)
    const declines = state.inserts.filter(
      (i) => i.table === "activity_events" && (i.row as Record<string, unknown>)?.event_type === "review_decline"
    )
    expect(declines).toHaveLength(1)
    const payload = (declines[0].row as Record<string, unknown>).payload as Record<string, unknown>
    expect(payload.request_id).toBe(REQUEST_ID)
    expect(payload.lawyer_id).toBe(LAWYER_ROW_ID)
  })

  it("rejects invalid transitions (complete from matched)", async () => {
    await expect(completeReview(REQUEST_ID)).rejects.toThrow(/Cannot complete from matched/)
  })
})

describe("lawyer comments and proposals", () => {
  it("validates comment input", async () => {
    await expect(addLawyerComment(REQUEST_ID, { targetType: "nope", body: "x" })).rejects.toThrow(/target/)
    await expect(addLawyerComment(REQUEST_ID, { targetType: "general", body: "  " })).rejects.toThrow(/1–5000/)
    await expect(
      addLawyerComment(REQUEST_ID, { targetType: "general", body: "x".repeat(5001) })
    ).rejects.toThrow(/1–5000/)
  })

  it("adds a comment on active reviews", async () => {
    const res = await addLawyerComment(REQUEST_ID, { targetType: "finding", targetKey: "rule-1", body: "Looks risky." })
    expect(res).toEqual({ success: true })
    expect(state.writes.some((w) => w.table === "review_comments" && w.op === "insert")).toBe(true)
  })

  it("proposes a change as a new version plus linked note and status", async () => {
    state.opts.requestRow = { ...ACTIVE_REQUEST, status: "in_progress" }
    const res = await proposeChange(REQUEST_ID, {
      documentType: "contract",
      revisedContent: "Revised contract text.",
      note: "Tightened liability.",
    })
    expect(res.success).toBe(true)
    expect(res.status).toBe("changes_requested")
    expect(res.versionId).toBe("v1")
  })

  it("propose requires an active proposable state", async () => {
    await expect(
      proposeChange(REQUEST_ID, { documentType: "contract", revisedContent: "x", note: "y" })
    ).rejects.toThrow(/Cannot propose from matched/)
  })
})

describe("admin assignment", () => {
  const ADMIN_ID = "00000000-0000-0000-0000-00000000ee05"

  it("rejects non-admins", async () => {
    state.opts.user = { id: ADMIN_ID }
    await expect(assignLawyer(REQUEST_ID, LAWYER_ROW_ID)).rejects.toThrow(/dministrator/)
  })

  it("assigns a verified lawyer to a pending review and nothing else", async () => {
    state.opts.user = { id: ADMIN_ID, app_metadata: { is_admin: true } }
    state.opts.requestRow = { id: REQUEST_ID, audit_id: AUDIT_ID, user_id: "owner-1", lawyer_id: null, status: "requested" }
    state.opts.lawyerRow = { id: LAWYER_ROW_ID }
    const res = await assignLawyer(REQUEST_ID, LAWYER_ROW_ID)
    expect(res).toEqual({ success: true, status: "matched" })
    const updates = state.writes.filter((w) => w.table === "consultation_requests" && w.op === "update")
    expect(updates).toHaveLength(1)
  })

  it("rejects unverified lawyers and wrong review states", async () => {
    state.opts.user = { id: ADMIN_ID, app_metadata: { is_admin: true } }
    state.opts.requestRow = { id: REQUEST_ID, audit_id: AUDIT_ID, user_id: "owner-1", lawyer_id: null, status: "requested" }
    state.opts.lawyerRow = null
    await expect(assignLawyer(REQUEST_ID, LAWYER_ROW_ID)).rejects.toThrow(/verified/)
    state.opts.lawyerRow = { id: LAWYER_ROW_ID }
    state.opts.requestRow = { id: REQUEST_ID, audit_id: AUDIT_ID, user_id: "owner-1", lawyer_id: LAWYER_ROW_ID, status: "in_progress" }
    await expect(assignLawyer(REQUEST_ID, LAWYER_ROW_ID)).rejects.toThrow(/Cannot assign/)
  })

  it("rejects malformed ids before any query", async () => {
    state.opts.user = { id: ADMIN_ID, app_metadata: { is_admin: true } }
    await expect(assignLawyer("nope", LAWYER_ROW_ID)).rejects.toThrow(/Invalid/)
    await expect(assignLawyer(REQUEST_ID, "nope")).rejects.toThrow(/Invalid/)
  })
})

describe("workspace overview", () => {
  it("buckets scoped workload without global counts", async () => {
    state.opts.listRows = [
      { id: "r1", lawyer_id: LAWYER_ROW_ID, status: "matched", updated_at: "2026-01-02" },
      { id: "r2", lawyer_id: LAWYER_ROW_ID, status: "in_progress", updated_at: "2026-01-03" },
      { id: "r3", lawyer_id: LAWYER_ROW_ID, status: "changes_requested", updated_at: "2026-01-01" },
      { id: "r4", lawyer_id: LAWYER_ROW_ID, status: "completed", updated_at: "2026-01-04" },
    ]
    state.opts.activityRows = [{ id: "e1", event_type: "review_assigned", created_at: "2026-01-04" }]
    const res = await getLawyerOverview()
    expect(res.success).toBe(true)
    expect(res.buckets).toEqual({ needsAction: 2, inReview: 0, waitingClient: 1, completed: 1 })
    expect(res.totalAssigned).toBe(4)
    expect(res.actionItems).toHaveLength(2)
    expect(res.recentActivity).toHaveLength(1)
  })

  it("denies unverified lawyers", async () => {
    state.opts.lawyerRow = null
    await expect(getLawyerOverview()).rejects.toThrow(/verified lawyer profile/)
  })
})

describe("workspace listing", () => {
  it("filters by status and needs-action server-side with bounded pages", async () => {
    state.opts.listRows = [
      { id: "r1", lawyer_id: LAWYER_ROW_ID, status: "matched", updated_at: "2026-01-02" },
      { id: "r2", lawyer_id: LAWYER_ROW_ID, status: "completed", updated_at: "2026-01-03" },
    ]
    const filtered = await listAssignedReviews({ status: "matched", limit: 20, offset: 0 })
    expect(filtered.reviews.map((r) => r.id)).toEqual(["r1"])
    const actionOnly = await listAssignedReviews({ needsAction: true })
    expect(actionOnly.reviews.every((r) => r.needsAction)).toBe(true)
    expect(actionOnly.reviews.map((r) => r.id)).toEqual(["r1"])
  })

  it("never leaks another lawyer's reviews (fence enforced in query)", async () => {
    state.opts.listRows = [
      { id: "mine", lawyer_id: LAWYER_ROW_ID, status: "matched", updated_at: "2026-01-02" },
      { id: "theirs", lawyer_id: "other-lawyer", status: "matched", updated_at: "2026-01-03" },
    ]
    const res = await listAssignedReviews()
    expect(res.reviews.map((r) => r.id)).toEqual(["mine"])
  })

  it("ignores unknown status values instead of widening", async () => {
    state.opts.listRows = [{ id: "r1", lawyer_id: LAWYER_ROW_ID, status: "matched", updated_at: "2026-01-02" }]
    const res = await listAssignedReviews({ status: "admin'" })
    // Unknown filter is dropped; the lawyer fence still applies.
    expect(res.reviews).toHaveLength(1)
  })
})

describe("workspace activity and service orders", () => {
  it("returns scoped activity through the RPC", async () => {
    state.opts.activityRows = [{ id: "e1", event_type: "review_comment_added", created_at: "2026-01-05" }]
    const res = await getReviewActivity(REQUEST_ID, 20)
    expect(res.success).toBe(true)
    expect(res.events).toHaveLength(1)
  })

  it("rejects malformed request ids before any query", async () => {
    await expect(getReviewActivity("nope")).rejects.toThrow(/Invalid/)
  })

  it("shows assigned service orders without earnings", async () => {
    state.opts.orderRows = [{ id: "o1", amount_minor: null, currency: null, status: "requested" }]
    const res = await getReviewServiceOrders(REQUEST_ID)
    expect(res.success).toBe(true)
    expect(res.orders).toHaveLength(1)
    expect(res.orders[0]).not.toHaveProperty("payout")
  })

  it("denies service orders on unassigned reviews", async () => {
    state.opts.requestRow = { ...ACTIVE_REQUEST, lawyer_id: "other-lawyer" }
    await expect(getReviewServiceOrders(REQUEST_ID)).rejects.toThrow(/Not assigned/)
  })
})

describe("workspace profile", () => {
  it("returns the lawyer's own profile read-only", async () => {
    state.opts.user = { id: LAWYER_USER_ID, email: "lawyer@example.com" }
    state.opts.profileRow = {
      id: LAWYER_ROW_ID,
      full_name: "Ada Lawyer",
      verification_status: "verified",
    }
    const res = await getOwnLawyerProfile()
    expect(res.success).toBe(true)
    expect(res.profile).toMatchObject({ full_name: "Ada Lawyer", email: "lawyer@example.com" })
  })

  it("requires authentication", async () => {
    state.opts.user = null
    await expect(getOwnLawyerProfile()).rejects.toThrow(/Unauthorized/)
  })
})
