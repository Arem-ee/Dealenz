import { describe, it, expect, vi, beforeEach } from "vitest"
import { ensureSigningMonitoring } from "./actions"

// Notice-deadline extraction at signing: executed deals get dated
// obligations pulled from the signed text into monitoring, once per
// version, never for unverified users, never breaking the view.

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const verifiedUser = { id: "00000000-0000-0000-0000-000000000001", email: "t@t.co", email_confirmed_at: "2024-01-01" }
const unverifiedUser = { ...verifiedUser, email_confirmed_at: null }
const AUDIT_ID = "00000000-0000-0000-0000-000000000002"
const VERSION_ID = "00000000-0000-0000-0000-000000000003"

function chain(data: unknown, onUpdate?: (arg: unknown) => void) {
  const b: Record<string, (...args: unknown[]) => unknown> = {}
  b.select = vi.fn(() => b)
  b.eq = vi.fn(() => b)
  b.order = vi.fn(() => b)
  b.limit = vi.fn(() => b)
  b.maybeSingle = vi.fn(() => Promise.resolve({ data, error: null }))
  b.single = vi.fn(() => Promise.resolve({ data, error: null }))
  b.insert = vi.fn(() => b)
  b.update = vi.fn((arg: unknown) => {
    onUpdate?.(arg)
    return b
  })
  b.then = ((resolve: (v: unknown) => unknown) => resolve({ data, error: null })) as unknown as (...args: unknown[]) => unknown
  return b
}

function auditRow(structured: Record<string, unknown>) {
  return { id: AUDIT_ID, structured_data: structured, raw_input: "some deal text" }
}

function setup(options: {
  user?: { id: string; email: string; email_confirmed_at: string | null }
  structured?: Record<string, unknown>
  versions?: Array<{ id: string; content: string | null }>
  finals?: Array<{ document_version_id: string }>
  existingEvents?: Array<Record<string, unknown>>
}) {
  const updates: unknown[] = []
  const inserts: unknown[] = []
  const versions = options.versions ?? [{ id: VERSION_ID, content: "Renewal date: 2027-03-01. Payment due: 2027-04-01." }]
  mockGetUser.mockResolvedValue({ data: { user: options.user ?? verifiedUser }, error: null })
  mockFrom.mockImplementation((table: string) => {
    if (table === "audits") return chain(auditRow(options.structured ?? {}), (arg) => updates.push(arg))
    if (table === "document_versions") return chain(versions)
    if (table === "final_documents") return chain(options.finals ?? [])
    if (table === "monitoring_events") {
      const b = chain(options.existingEvents ?? [])
      const rawInsert = b.insert as ReturnType<typeof vi.fn>
      rawInsert.mockImplementation((arg: unknown) => {
        inserts.push(arg)
        return chain({ id: "evt-new", provenance: "exact" })
      })
      return b
    }
    if (table === "deal_intelligence_events") return chain(null)
    return chain(null)
  })
  return { updates, inserts }
}

describe("ensureSigningMonitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("skips silently for unverified users without touching the DB", async () => {
    setup({ user: unverifiedUser })
    const res = await ensureSigningMonitoring(AUDIT_ID)
    expect(res).toEqual({ ok: true, skipped: true })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("extracts dated obligations from the signed text into monitoring events", async () => {
    const { updates, inserts } = setup({
      structured: {
        deterministicFindings: [
          {
            status: "FAIL",
            ruleKey: "k",
            finding: { severity: "material", summary: "Renewal ambiguous, confirm the date", evidence: [] },
          },
        ],
      },
    })
    const res = await ensureSigningMonitoring(AUDIT_ID)
    expect(res.ok).toBe(true)
    if (res.ok && !("skipped" in res)) {
      expect(res.created).toBe(3)
      expect(res.total).toBe(3)
      expect(res.versionId).toBe(VERSION_ID)
    }
    expect(inserts).toHaveLength(3)
    const flagUpdate = updates
      .map((u) => (u as { structured_data?: Record<string, unknown> }).structured_data)
      .find((sd) => sd && "monitoringExtracted" in sd)
    expect((flagUpdate?.monitoringExtracted as { versionId: string }).versionId).toBe(VERSION_ID)
  })

  it("does not re-extract a version that already ran", async () => {
    const { inserts } = setup({
      structured: { monitoringExtracted: { versionId: VERSION_ID, extractedAt: "2026-01-01", created: 2 } },
      existingEvents: [
        { title: "Renewal date — 2027-03-01", source: "extracted", document_version_id: VERSION_ID },
      ],
    })
    const res = await ensureSigningMonitoring(AUDIT_ID)
    expect(res.ok).toBe(true)
    if (res.ok && !("skipped" in res)) {
      expect(res.created).toBe(0)
      expect(res.total).toBe(1)
    }
    expect(inserts).toHaveLength(0)
  })

  it("records the run even when the signed text holds no dates", async () => {
    const { updates } = setup({
      versions: [{ id: VERSION_ID, content: "A simple agreement with no dates whatsoever in it." }],
      structured: {},
    })
    const res = await ensureSigningMonitoring(AUDIT_ID)
    expect(res.ok).toBe(true)
    if (res.ok && !("skipped" in res)) {
      expect(res.created).toBe(0)
    }
    const flagUpdate = updates
      .map((u) => (u as { structured_data?: Record<string, unknown> }).structured_data)
      .find((sd) => sd && "monitoringExtracted" in sd)
    expect(flagUpdate?.monitoringExtracted).toMatchObject({ versionId: VERSION_ID, created: 0 })
  })
})
