import { describe, it, expect, vi, beforeEach } from "vitest"
import { logPushbackCopy } from "./actions"

// Flywheel telemetry: copy events carry rule + deal linkage, never content,
// never throw, never require more than auth.

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const verifiedUser = { id: "00000000-0000-0000-0000-000000000001", email: "t@t.co", email_confirmed_at: "2024-01-01" }
const AUDIT_ID = "00000000-0000-0000-0000-000000000002"

function chain(data: unknown, onInsert?: (arg: unknown) => void) {
  const b: Record<string, (...args: unknown[]) => unknown> = {}
  b.select = vi.fn(() => b)
  b.eq = vi.fn(() => b)
  b.maybeSingle = vi.fn(() => Promise.resolve({ data, error: null }))
  b.insert = vi.fn((arg: unknown) => {
    onInsert?.(arg)
    return Promise.resolve({ error: null })
  })
  b.then = ((resolve: (v: unknown) => unknown) => resolve({ data, error: null })) as unknown as (...args: unknown[]) => unknown
  return b
}

describe("logPushbackCopy", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: verifiedUser }, error: null })
  })

  it("logs rule linkage without content for own deals", async () => {
    const inserts: unknown[] = []
    mockFrom.mockImplementation((table: string) => {
      if (table === "audits") return chain({ id: AUDIT_ID })
      if (table === "activity_events") return chain(null, (arg) => inserts.push(arg))
      return chain(null)
    })
    const res = await logPushbackCopy({ auditId: AUDIT_ID, ruleKey: "freelance-unlimited-revisions" })
    expect(res).toEqual({ ok: true })
    expect(inserts).toHaveLength(1)
    const row = inserts[0] as Record<string, unknown>
    expect(row.event_type).toBe("pushback_copied")
    expect(row.audit_id).toBe(AUDIT_ID)
    expect((row.payload as Record<string, unknown>).ruleKey).toBe("freelance-unlimited-revisions")
    expect(JSON.stringify(row)).not.toContain("Please cap revisions")
  })

  it("drops linkage for other users' deals but still counts the copy", async () => {
    const inserts: unknown[] = []
    mockFrom.mockImplementation((table: string) => {
      if (table === "audits") return chain(null)
      if (table === "activity_events") return chain(null, (arg) => inserts.push(arg))
      return chain(null)
    })
    const res = await logPushbackCopy({ auditId: AUDIT_ID, ruleKey: "k" })
    expect(res).toEqual({ ok: true })
    expect((inserts[0] as Record<string, unknown>).audit_id).toBeNull()
  })

  it("rejects bad input and anonymous callers without touching the DB", async () => {
    expect(await logPushbackCopy({ ruleKey: "" })).toEqual({ ok: false })
    expect(mockFrom).not.toHaveBeenCalled()
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await logPushbackCopy({ ruleKey: "k" })).toEqual({ ok: false })
  })
})
