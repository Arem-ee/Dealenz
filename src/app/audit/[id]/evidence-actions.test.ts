import { describe, it, expect, vi, beforeEach } from "vitest"
import { inspectSourceEvidence } from "./evidence-actions"
import { makeEvidence } from "@/lib/evidence/schema"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockDownload = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: { from: () => ({ download: mockDownload }) },
  })),
}))

const mockUser = { id: "00000000-0000-0000-0000-000000000001", email: "test@test.com", email_confirmed_at: "2024-01-01" }
const AUDIT_ID = "00000000-0000-0000-0000-000000000002"

function tableMock(singleResult: unknown) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.single = vi.fn().mockResolvedValue(singleResult)
  return builder
}

function auditRow(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: AUDIT_ID,
      user_id: mockUser.id,
      raw_input: "Scope: website.\nUnlimited revisions until approval, plus support.",
      structured_data: { files: [] },
      ...overrides,
    },
    error: null,
  }
}

function auditEvidence() {
  return makeEvidence({
    sourceType: "audit_input",
    sourceId: AUDIT_ID,
    quote: "unlimited revisions until approval",
    observationKey: "facts.freelance.revisions",
    method: "pattern_observation",
    confidence: 0.8,
    inspectable: true,
    location: { kind: "approximate", section: "raw_input" },
  })
}

beforeEach(() => {
  mockGetUser.mockReset()
  mockFrom.mockReset()
  mockDownload.mockReset()
})

describe("evidence inspection security", () => {
  it("lets the owner inspect owned evidence", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockFrom.mockImplementation(() => tableMock(auditRow()))
    const result = await inspectSourceEvidence(AUDIT_ID, JSON.parse(JSON.stringify(auditEvidence())) as unknown)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.inspected.status).toBe("APPROXIMATE")
    expect(result.inspected.documentLabel).toBe("Pasted input")
    expect(result.inspected.documentText).toContain("Unlimited revisions")
  })

  it("rejects non-owners (row invisible under ownership filter)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockFrom.mockImplementation(() => tableMock({ data: null, error: { message: "none" } }))
    const result = await inspectSourceEvidence(AUDIT_ID, auditEvidence())
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.error).toMatch(/not found/i)
  })

  it("rejects unauthenticated users", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await inspectSourceEvidence(AUDIT_ID, auditEvidence())
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.error).toMatch(/signed in/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("rejects malformed audit IDs without touching the database", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const result = await inspectSourceEvidence("not-a-uuid", auditEvidence())
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.error).toMatch(/invalid audit/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("rejects malformed evidence without touching the database", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const result = await inspectSourceEvidence(AUDIT_ID, { bogus: true })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.error).toMatch(/invalid evidence/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("rejects cross-audit evidence even when the audit is owned", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockFrom.mockImplementation(() => tableMock(auditRow()))
    const foreign = makeEvidence({
      sourceType: "audit_input",
      sourceId: "00000000-0000-0000-0000-000000000099",
      quote: "unlimited revisions until approval",
      observationKey: "facts.freelance.revisions",
      method: "pattern_observation",
      confidence: 0.8,
      inspectable: true,
      location: { kind: "approximate", section: "raw_input" },
    })
    const result = await inspectSourceEvidence(AUDIT_ID, foreign)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("unreachable")
    expect(result.error).toMatch(/does not belong/i)
  })

  it("returns unavailable (not an error) for knowledge evidence", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockFrom.mockImplementation(() => tableMock(auditRow()))
    const knowledge = makeEvidence({
      sourceType: "knowledge",
      sourceId: "us-copyright-transfer-writing",
      sourceVersion: 1,
      quote: null,
      observationKey: "knowledge:us-copyright-transfer-writing",
      method: "knowledge_reference",
      confidence: 0.9,
      inspectable: true,
      location: { kind: "unavailable" },
    })
    const result = await inspectSourceEvidence(AUDIT_ID, knowledge)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.inspected.status).toBe("UNAVAILABLE")
    expect(result.inspected.documentText).toBeNull()
  })

  it("reads uploaded file content through ownership-checked paths", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockFrom.mockImplementation(() =>
      tableMock(
        auditRow({
          raw_input: "",
          structured_data: {
            files: [{ name: "contract.pdf", type: "text/plain", path: `audit-files/${mockUser.id}/${AUDIT_ID}/contract.pdf` }],
          },
        })
      )
    )
    mockDownload.mockResolvedValue({
      data: { arrayBuffer: async () => new TextEncoder().encode("The tenant pays rent monthly.").buffer },
      error: null,
    })
    const fileEvidence = makeEvidence({
      sourceType: "audit_input",
      sourceId: AUDIT_ID,
      quote: "tenant pays rent monthly",
      observationKey: "facts.lease.rent",
      method: "pattern_observation",
      confidence: 0.8,
      inspectable: true,
      location: { kind: "approximate", section: "contract.pdf" },
    })
    const result = await inspectSourceEvidence(AUDIT_ID, fileEvidence)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.inspected.status).toBe("APPROXIMATE")
    expect(result.inspected.documentLabel).toBe("contract.pdf")
    expect(mockDownload).toHaveBeenCalledTimes(1)
  })

  it("performs zero credit operations", async () => {
    const source = [
      "reserve_credits",
      "finalize_reservation",
      "void_reservation",
      "grant_credits",
      "credit_balance",
      "callAISurface",
      "ANTHROPIC_API_KEY",
    ].join("|")
    const { readFileSync } = await import("node:fs")
    const actionSource = readFileSync("src/app/audit/[id]/evidence-actions.ts", "utf8")
    expect(actionSource).not.toMatch(new RegExp(source))
  })
})
