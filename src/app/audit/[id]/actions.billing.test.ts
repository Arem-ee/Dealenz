import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Billing enforcement: every AI-costing entry point reserves before work,
// finalizes on success, and voids on failure. These tests pin the ledger
// calls so a future refactor cannot silently reintroduce free AI.

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())
const mockStorageFrom = vi.hoisted(() => vi.fn())
const mockCheckRateLimit = vi.hoisted(() => vi.fn())
const mockExtractAndValidate = vi.hoisted(() => vi.fn())
const mockAnalyzeRiskFn = vi.hoisted(() => vi.fn())
const mockNegotiationPointsFn = vi.hoisted(() => vi.fn())
const mockGenerateDocuments = vi.hoisted(() => vi.fn())
const mockCookieGet = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
    storage: { from: mockStorageFrom },
  })),
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mockCookieGet, set: vi.fn() })),
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock("@/lib/ai/extract", () => ({
  extractProjectData: vi.fn(),
  extractAndValidate: mockExtractAndValidate,
}))

vi.mock("@/lib/ai/risk-analysis", () => ({
  analyzeRisk: mockAnalyzeRiskFn,
  analyzeGenericRiskWithVisibleFailure: vi.fn(),
}))

vi.mock("@/lib/ai/negotiation", () => ({
  generateNegotiationPoints: mockNegotiationPointsFn,
}))

vi.mock("@/lib/generate", () => ({
  generateDocuments: mockGenerateDocuments,
}))

vi.mock("@/lib/logger", () => ({
  logEvent: vi.fn(),
  logDuration: vi.fn(() => 1),
  reportError: vi.fn(),
  reportAIFallback: vi.fn(),
}))

vi.mock("./actions", async () => ({ ...(await vi.importActual<typeof import("./actions")>("./actions")) }))

import { analyzeDeal, generateProtectionPackage } from "./actions"

const mockUser = { id: "00000000-0000-0000-0000-000000000001", email: "test@test.com", email_confirmed_at: "2024-01-01" }

function qb(resolveTo: unknown = { data: null, error: null }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    is: vi.fn(() => builder),
    or: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    update: vi.fn(() => builder),
    then: (resolve: (v: unknown) => unknown) => resolve(resolveTo),
  }
  return builder as never
}

function auditsQuery(auditRow: unknown, lockRows: unknown[]) {
  const builder = qb()
  let updated = false
  let sawSelectAfterUpdate = false
  const b = builder as unknown as Record<string, ReturnType<typeof vi.fn>>
  b.single = vi.fn().mockResolvedValue({ data: auditRow, error: null })
  b.update = vi.fn(() => {
    updated = true
    return builder
  })
  b.or = vi.fn(() => builder)
  b.select = vi.fn(() => {
    if (updated) sawSelectAfterUpdate = true
    return builder
  })
  b.then = vi.fn((resolve: (v: unknown) => unknown) => {
    if (updated && sawSelectAfterUpdate) {
      sawSelectAfterUpdate = false
      return resolve({ data: lockRows, error: null })
    }
    return resolve({ data: null, error: null })
  })
  return builder
}

function consentQb() {
  const b = qb({ data: { has_consented_to_ai_analysis: true }, error: null })
  const bb = b as unknown as Record<string, ReturnType<typeof vi.fn>>
  bb.maybeSingle = vi.fn().mockResolvedValue({ data: { has_consented_to_ai_analysis: true }, error: null })
  return b
}

const mockExtractedData = {
  goals: ["Launch website"],
  deliverables: ["Design", "Development"],
  timeline: "3 months",
  budget: "50000",
  projectType: "web",
  clientSignals: [],
  missingInformation: [],
  confidence: 0.8,
}

const mockRiskReport = {
  overallScore: 72,
  riskLevel: "Medium",
  summary: "Medium risk",
  categories: {},
  recommendations: [],
}

function ledgerAllow() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === "reserve_credits") return Promise.resolve({ data: [{ allowed: true, balance: 100, reservation_id: "res-test" }], error: null })
    if (fn === "finalize_reservation") return Promise.resolve({ data: [{ balance: 95 }], error: null })
    if (fn === "void_reservation") return Promise.resolve({ data: null, error: null })
    if (fn === "credit_balance") return Promise.resolve({ data: [{ balance: 100 }], error: null })
    return Promise.resolve({ data: null, error: null })
  })
}

describe("billing enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true })
    mockCookieGet.mockReturnValue(undefined)
    ledgerAllow()
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: mockExtractedData })
    mockAnalyzeRiskFn.mockResolvedValue({ report: mockRiskReport, usedFallback: false })
    mockNegotiationPointsFn.mockResolvedValue([])
  })

  it("analyzeDeal reserves 5 and finalizes on success", async () => {
    const audits = auditsQuery(
      { id: "audit-1", ai_consent: true, raw_input: "Build a website", structured_data: { files: [] } },
      [{ id: "audit-1" }]
    )
    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQb() : table === "audits" ? audits : qb()))

    const result = await analyzeDeal("audit-1")

    expect(result.success).toBe(true)
    const reserve = mockRpc.mock.calls.find(([fn]) => fn === "reserve_credits")
    expect(reserve).toBeDefined()
    expect((reserve as unknown[])[1]).toMatchObject({ p_amount: 5 })
    expect(mockRpc).toHaveBeenCalledWith("finalize_reservation", expect.objectContaining({ p_consumption_amount: 5 }))
    expect(mockRpc).not.toHaveBeenCalledWith("void_reservation", expect.anything())
  })

  it("analyzeDeal voids the hold and charges nothing on failure", async () => {
    mockExtractAndValidate.mockResolvedValue({ valid: false, reason: "insufficient_fields" })
    const audits = auditsQuery(
      { id: "audit-1", ai_consent: true, raw_input: "hi", structured_data: { files: [] } },
      [{ id: "audit-1" }]
    )
    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQb() : table === "audits" ? audits : qb()))

    const result = await analyzeDeal("audit-1")

    expect(result.success).toBe(false)
    expect(mockRpc).toHaveBeenCalledWith("reserve_credits", expect.anything())
    expect(mockRpc).toHaveBeenCalledWith("void_reservation", expect.anything())
    expect(mockRpc).not.toHaveBeenCalledWith("finalize_reservation", expect.anything())
  })

  it("analyzeDeal refuses without charging when balance is insufficient", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "reserve_credits") return Promise.resolve({ data: [{ allowed: false, balance: 0, reservation_id: null }], error: null })
      return Promise.resolve({ data: null, error: null })
    })
    const audits = auditsQuery(
      { id: "audit-1", ai_consent: true, raw_input: "Build a website", structured_data: { files: [] } },
      [{ id: "audit-1" }]
    )
    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQb() : table === "audits" ? audits : qb()))

    const result = await analyzeDeal("audit-1")

    expect(result.success).toBe(false)
    expect(String(result.error)).toMatch(/credit/i)
    expect(mockExtractAndValidate).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalledWith("finalize_reservation", expect.anything())
  })

  it("generateProtectionPackage reserves the 55-credit package and finalizes on success", async () => {
    const row = {
      id: "audit-1",
      user_id: mockUser.id,
      deal_type: "freelance",
      status: "analyzed",
      raw_input: "Build a website",
      structured_data: { extractedData: mockExtractedData },
      risk_report: mockRiskReport,
    }
    const q = qb()
    const qq = q as unknown as Record<string, ReturnType<typeof vi.fn>>
    qq.single = vi.fn().mockResolvedValue({ data: row, error: null })
    qq.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null }))
    qq.limit = vi.fn(() => q)
    qq.update = vi.fn(() => q)
    qq.order = vi.fn(() => q)
    qq.is = vi.fn(() => q)
    qq.insert = vi.fn(() => Promise.resolve({ error: null }))
    const consentQ = consentQb()
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_ai_consents") return consentQ
      if (table === "business_profiles") return qb({ data: null, error: null })
      return q as never
    })
    mockGenerateDocuments.mockResolvedValue({
      proposal: { content: "P", method: "ai" },
      sow: { content: "S", method: "ai" },
      contract: { content: "C", method: "ai" },
      checklist: { content: "- [ ] Done", method: "ai" },
    })

    const result = await generateProtectionPackage("audit-1")

    expect(result.success).toBe(true)
    const reserve = mockRpc.mock.calls.find(([fn]) => fn === "reserve_credits")
    expect(reserve).toBeDefined()
    expect((reserve as unknown[])[1]).toMatchObject({ p_amount: 55 })
    expect(mockRpc).toHaveBeenCalledWith("finalize_reservation", expect.objectContaining({ p_consumption_amount: 55 }))
  })
})
