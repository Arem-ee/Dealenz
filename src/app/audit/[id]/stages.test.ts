import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockAuditRow = vi.hoisted(() => ({ value: null as null | { id: string; deal_type: string } }))
const mockLogRows = vi.hoisted(() => ({ value: [] as Array<{ phase: string; status: string }> }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      const builder: Record<string, unknown> = {}
      builder.select = vi.fn(() => builder)
      builder.eq = vi.fn(() => builder)
      builder.maybeSingle = vi.fn(() => {
        if (table === "audits") return Promise.resolve({ data: mockAuditRow.value, error: null })
        return Promise.resolve({ data: null, error: null })
      })
      return builder
    },
  })),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {}
      builder.select = vi.fn(() => builder)
      builder.eq = vi.fn(() => builder)
      builder.order = vi.fn(() => builder)
      builder.limit = vi.fn(() => {
        if (table === "system_logs") return Promise.resolve({ data: mockLogRows.value, error: null })
        return Promise.resolve({ data: [], error: null })
      })
      return builder
    },
  })),
}))

import { getAnalysisStages } from "./stages"

const USER = { id: "00000000-0000-0000-0000-000000000001", email_confirmed_at: "2024-01-01" }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key"
  mockGetUser.mockResolvedValue({ data: { user: USER } })
  mockAuditRow.value = { id: "audit-1", deal_type: "founder" }
  mockLogRows.value = []
})

describe("getAnalysisStages", () => {
  it("maps a running analysis to one active stage", async () => {
    mockLogRows.value = [
      { phase: "knowledge", status: "success" },
      { phase: "extraction", status: "success" },
      { phase: "risk", status: "start" },
    ]
    const res = await getAnalysisStages("audit-1")
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.stages.find((s) => s.key === "risk")?.state).toBe("active")
      expect(res.stages.filter((s) => s.state === "active")).toHaveLength(1)
    }
  })

  it("drops previous-run rows at the latest extraction start", async () => {
    mockLogRows.value = [
      { phase: "extraction", status: "success" },
      { phase: "risk", status: "success" },
      { phase: "rules", status: "success" },
      // Re-analysis begins: stale successes must not paint the new run done.
      { phase: "knowledge", status: "success" },
      { phase: "extraction", status: "start" },
    ]
    const res = await getAnalysisStages("audit-1")
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.stages.find((s) => s.key === "risk")?.state).toBe("pending")
      expect(res.stages.find((s) => s.key === "extracting")?.state).toBe("active")
    }
  })

  it("omits the responses stage for freelance deals", async () => {
    mockAuditRow.value = { id: "audit-1", deal_type: "freelance" }
    mockLogRows.value = [{ phase: "extraction", status: "success" }]
    const res = await getAnalysisStages("audit-1")
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.stages.map((s) => s.key)).not.toContain("responses")
    }
  })

  it("fails closed on missing auth, ownership, and config", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect((await getAnalysisStages("audit-1")).ok).toBe(false)
    mockGetUser.mockResolvedValue({ data: { user: USER } })
    mockAuditRow.value = null
    expect((await getAnalysisStages("audit-1")).ok).toBe(false)
    mockAuditRow.value = { id: "audit-1", deal_type: "founder" }
    expect((await getAnalysisStages("")).ok).toBe(false)
  })
})
