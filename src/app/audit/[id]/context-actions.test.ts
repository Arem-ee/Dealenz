import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  confirmContext,
  ensureContextEnvelope,
  getContext,
  inferAndPersistContext,
} from "./context-actions"
import { seedEnvelopeForDealType } from "@/lib/context/schema"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const fetchMock = vi.fn()

const mockUser = { id: "00000000-0000-0000-0000-000000000001", email: "test@test.com", email_confirmed_at: "2024-01-01" }
const AUDIT_ID = "00000000-0000-0000-0000-000000000002"

function tableMock(singleResult: unknown, updateResult: unknown = { data: null, error: null }) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.single = vi.fn().mockResolvedValue(singleResult)
  builder.update = vi.fn(() => builder)
  builder.insert = vi.fn().mockResolvedValue({ data: null, error: null })
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(updateResult).then(resolve)
  return builder
}

function mockAuditRow(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: AUDIT_ID,
      user_id: mockUser.id,
      deal_type: "freelance",
      raw_input: "Website build for a London client.",
      context_envelope: null,
      context_version: 0,
      ...overrides,
    },
    error: null,
  }
}

function routeTables(auditsBuilder: Record<string, unknown>) {
  mockFrom.mockImplementation((table: string) =>
    table === "audits" ? auditsBuilder : tableMock({ data: null, error: null })
  )
}

beforeEach(() => {
  mockGetUser.mockReset()
  mockFrom.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-sentinel")
  vi.stubEnv("AUTH_AI_MODEL", "claude-sonnet-5")
  vi.stubEnv("AUTH_AI_FALLBACK_MODEL", "claude-opus-5")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("context actions security", () => {
  it("rejects unauthenticated reads", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await getContext(AUDIT_ID)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/signed in/)
  })

  it("denies non-owner reads (row invisible under ownership filter)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    routeTables(tableMock({ data: null, error: { message: "none" } }))
    const result = await getContext(AUDIT_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Audit not found")
  })

  it("rejects unauthenticated confirmation writes", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await confirmContext(AUDIT_ID, { jurisdiction: { value: "Canada" } })
    expect(result.success).toBe(false)
  })

  it("rejects unverified users for inference (AI-costing operation)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { ...mockUser, email_confirmed_at: null } },
      error: null,
    })
    routeTables(tableMock(mockAuditRow()))
    const result = await inferAndPersistContext(AUDIT_ID)
    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects invalid source/state server-side", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const seeded = seedEnvelopeForDealType("freelance")
    routeTables(tableMock(mockAuditRow({ context_envelope: seeded, context_version: 1 })))
    const badRole = await confirmContext(AUDIT_ID, { userRole: { value: "not_a_role" } })
    expect(badRole.success).toBe(false)
    expect(badRole.error).toMatch(/invalid value/)
    const badShape = await confirmContext(AUDIT_ID, [] as unknown as Record<string, { value: unknown }>)
    expect(badShape.success).toBe(false)
  })

  it("rejects malformed audit IDs without touching the database", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const result = await getContext("not-a-uuid")
    expect(result.success).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe("context actions behavior", () => {
  it("reads the owner envelope with its gate state", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const seeded = seedEnvelopeForDealType("freelance")
    routeTables(tableMock(mockAuditRow({ context_envelope: seeded, context_version: 1 })))
    const result = await getContext(AUDIT_ID)
    expect(result.success).toBe(true)
    expect(result.envelope?.fields.dealType.source).toBe("user_confirmed")
    expect(result.gate?.state).toBe("READY")
  })

  it("reports MISSING_REQUIRED_CONTEXT when no envelope exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    routeTables(tableMock(mockAuditRow()))
    const result = await getContext(AUDIT_ID)
    expect(result.success).toBe(true)
    expect(result.envelope).toBeUndefined()
    expect(result.gate?.state).toBe("MISSING_REQUIRED_CONTEXT")
  })

  it("seeds legacy audits from the deal_type column and persists version 1", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const audits = tableMock(mockAuditRow())
    routeTables(audits)
    const result = await ensureContextEnvelope(AUDIT_ID)
    expect(result.success).toBe(true)
    expect(result.envelope?.version).toBe(1)
    expect(result.envelope?.fields.dealType).toEqual({
      value: "freelance",
      source: "user_confirmed",
      confidence: 1,
    })
    expect(audits.update).toHaveBeenCalled()
  })

  it("persists user corrections as confirmed with a version bump", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const seeded = seedEnvelopeForDealType("freelance")
    const audits = tableMock(mockAuditRow({ context_envelope: seeded, context_version: 1 }))
    routeTables(audits)
    const result = await confirmContext(AUDIT_ID, { jurisdiction: { value: "United Kingdom" } })
    expect(result.success).toBe(true)
    expect(result.envelope?.version).toBe(2)
    expect(result.envelope?.fields.jurisdiction.source).toBe("user_confirmed")
    expect(result.envelope?.fields.dealType.source).toBe("user_confirmed")
    expect(audits.update).toHaveBeenCalled()
  })

  it("infers, merges, and persists context without clobbering confirmed fields", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const seeded = seedEnvelopeForDealType("freelance")
    seeded.fields.industry = { value: "finance", source: "user_confirmed", confidence: 1 }
    routeTables(tableMock(mockAuditRow({ context_envelope: seeded, context_version: 1 })))
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                jurisdiction: { value: "United Kingdom", confidence: 0.8 },
                industry: { value: "technology", confidence: 0.9 },
              }),
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    const result = await inferAndPersistContext(AUDIT_ID)
    expect(result.success).toBe(true)
    expect(result.envelope?.fields.jurisdiction.source).toBe("inferred")
    // User-confirmed industry survives the inference pass.
    expect(result.envelope?.fields.industry).toEqual({ value: "finance", source: "user_confirmed", confidence: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("refuses inference with no deal input and makes no model call", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    routeTables(tableMock(mockAuditRow({ raw_input: "   " })))
    const result = await inferAndPersistContext(AUDIT_ID)
    expect(result.success).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
