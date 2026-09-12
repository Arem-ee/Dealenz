import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ExtractedData } from "@/lib/ai/extract"

// ── Hoisted shared mocks (mirrors actions.test.ts harness, plus neq + cookies) ──

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())
const mockStorageFrom = vi.hoisted(() => vi.fn())
const mockCheckRateLimit = vi.hoisted(() => vi.fn())
const mockExtractAndValidate = vi.hoisted(() => vi.fn())
const mockAnalyzeRiskFn = vi.hoisted(() => vi.fn())
const mockAnalyzeGenericRiskFn = vi.hoisted(() => vi.fn())
const mockNegotiationPointsFn = vi.hoisted(() => vi.fn())
const mockGenerateDocuments = vi.hoisted(() => vi.fn())
const mockLogEvent = vi.hoisted(() => vi.fn())
const mockLogDuration = vi.hoisted(() => vi.fn(() => 100))
const mockCookieGet = vi.hoisted(() => vi.fn())
const mockCookieSet = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
    storage: { from: mockStorageFrom },
  })),
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mockCookieGet, set: mockCookieSet })),
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
  analyzeGenericRiskWithVisibleFailure: mockAnalyzeGenericRiskFn,
}))

vi.mock("@/lib/ai/negotiation", () => ({
  generateNegotiationPoints: mockNegotiationPointsFn,
}))

vi.mock("@/lib/generate", () => ({
  generateDocuments: mockGenerateDocuments,
}))

vi.mock("@/lib/logger", () => ({
  logEvent: mockLogEvent,
  logEventWithClient: vi.fn(),
  logDuration: mockLogDuration,
  reportError: vi.fn(),
  reportAIFallback: vi.fn(),
}))

vi.mock("./actions", async () => ({ ...(await vi.importActual<typeof import("./actions")>("./actions")) }))

import { analyzeDeal } from "./actions"

// ── Thenable query builder with neq support ──

interface Builder {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  neq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  or: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  then: (resolve: (v: unknown) => unknown) => unknown
}

function qb(resolveTo: unknown = { data: null, error: null }): Builder {
  const builder = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    order: () => builder,
    limit: () => builder,
    is: () => builder,
    or: () => builder,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    update: vi.fn(() => builder),
    then: (resolve: (v: unknown) => unknown) => resolve(resolveTo),
  } as unknown as Builder
  return builder
}

function auditsQuery(auditRow: unknown, lockRows: unknown[], priorAnalyzed: unknown[]) {
  const builder = qb()
  let updated = false
  let sawSelectAfterUpdate = false
  let guardNeq = false
  builder.single = vi.fn().mockResolvedValue({ data: auditRow, error: null })
  builder.update = vi.fn(() => {
    updated = true
    sawSelectAfterUpdate = false
    guardNeq = false
    return builder
  })
  builder.or = vi.fn(() => builder)
  builder.neq = vi.fn(() => {
    // Only the referral guard uses neq: serve priorAnalyzed at await time.
    guardNeq = true
    return builder
  }) as unknown as Builder["neq"]
  builder.select = vi.fn(() => {
    if (updated) sawSelectAfterUpdate = true
    return builder
  }) as unknown as Builder["select"]
  builder.then = vi.fn((resolve: (v: unknown) => unknown) => {
    if (guardNeq) {
      guardNeq = false
      return resolve({ data: priorAnalyzed, error: null })
    }
    if (updated && sawSelectAfterUpdate) {
      sawSelectAfterUpdate = false
      return resolve({ data: lockRows, error: null })
    }
    return resolve({ data: null, error: null })
  }) as unknown as Builder["then"]
  return builder
}

const mockUser = { id: "00000000-0000-0000-0000-000000000001", email: "test@test.com", email_confirmed_at: "2024-01-01" }

const mockExtractedData: ExtractedData = {
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

function rpcImpl(fn: string) {
  if (fn === "attribute_referral") return Promise.resolve({ data: [{ attributed: true }], error: null })
  if (fn === "claim_referral_reward") return Promise.resolve({ data: [{ rewarded: true, amount: 5 }], error: null })
  return Promise.resolve({ data: { allowed: true, current_count: 1 }, error: null })
}

describe("analyzeDeal referral edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true })
    mockRpc.mockImplementation(rpcImpl)
    mockCookieGet.mockReturnValue(undefined)
  })

  it("attributes a new account on first success when a valid cookie exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockCookieGet.mockImplementation((name: string) =>
      name === "dealenz_ref" ? { value: "ABC123XY" } : undefined
    )
    const audits = auditsQuery(
      { id: "audit-1", ai_consent: true, raw_input: "Build a website", structured_data: { files: [] } },
      [{ id: "audit-1" }],
      []
    )
    mockFrom.mockImplementation((table: string) => (table === "audits" ? audits : qb()))
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: mockExtractedData })
    mockAnalyzeRiskFn.mockResolvedValue({ report: mockRiskReport, usedFallback: false })

    const result = await analyzeDeal("audit-1")

    expect(result.success).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith("attribute_referral", { p_code: "ABC123XY" })
    expect(mockRpc).toHaveBeenCalledWith("claim_referral_reward")
  })

  it("never attributes an existing account, even with a valid cookie", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockCookieGet.mockImplementation((name: string) =>
      name === "dealenz_ref" ? { value: "ABC123XY" } : undefined
    )
    const audits = auditsQuery(
      { id: "audit-1", ai_consent: true, raw_input: "Build a website", structured_data: { files: [] } },
      [{ id: "audit-1" }],
      [{ id: "older-audit" }]
    )
    mockFrom.mockImplementation((table: string) => (table === "audits" ? audits : qb()))
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: mockExtractedData })
    mockAnalyzeRiskFn.mockResolvedValue({ report: mockRiskReport, usedFallback: false })

    const result = await analyzeDeal("audit-1")

    expect(result.success).toBe(true)
    expect(mockRpc).not.toHaveBeenCalledWith("attribute_referral", expect.anything())
    // Pending rewards from a legitimate earlier attribution are still claimed.
    expect(mockRpc).toHaveBeenCalledWith("claim_referral_reward")
  })

  it("claims without attributing when no cookie exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const audits = auditsQuery(
      { id: "audit-1", ai_consent: true, raw_input: "Build a website", structured_data: { files: [] } },
      [{ id: "audit-1" }],
      []
    )
    mockFrom.mockImplementation((table: string) => (table === "audits" ? audits : qb()))
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: mockExtractedData })
    mockAnalyzeRiskFn.mockResolvedValue({ report: mockRiskReport, usedFallback: false })

    const result = await analyzeDeal("audit-1")

    expect(result.success).toBe(true)
    expect(mockRpc).not.toHaveBeenCalledWith("attribute_referral", expect.anything())
    expect(mockRpc).toHaveBeenCalledWith("claim_referral_reward")
  })
})
