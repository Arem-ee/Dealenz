import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ExtractedData } from "@/lib/ai/extract"

// ── Hoisted shared mocks (mirrors actions.test.ts harness) ──

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

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
    storage: { from: mockStorageFrom },
  })),
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

// ── Thenable query builder ──

function qb(resolveTo: unknown = { data: null, error: null }) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    is: () => builder,
    or: () => builder,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    update: vi.fn(() => builder),
    then: (resolve: (v: unknown) => unknown) => resolve(resolveTo),
  }
  return builder
}

function auditsQuery(auditRow: unknown, lockRows: unknown[]) {
  const builder = qb()
  let updated = false
  builder.single = vi.fn().mockResolvedValue({ data: auditRow, error: null })
  builder.update = vi.fn(() => {
    updated = true
    return builder
  })
  builder.or = vi.fn(() => builder)
  const terminalSelect = vi.fn(() => {
    if (updated) return Promise.resolve({ data: lockRows, error: null })
    return builder
  })
  builder.select = terminalSelect as unknown as typeof builder.select
  return builder
}

const mockUser = { id: "00000000-0000-0000-0000-000000000001", email: "test@test.com", email_confirmed_at: "2024-01-01" }

function consentQb() {
  const b = qb({ data: { has_consented_to_ai_analysis: true }, error: null })
  b.maybeSingle = vi.fn().mockResolvedValue({ data: { has_consented_to_ai_analysis: true }, error: null })
  return b
}

const mockExtractedData: ExtractedData = {
  goals: ["Lease shop"],
  deliverables: ["Premises"],
  timeline: "12 months",
  budget: "$1,000",
  projectType: "lease",
  clientSignals: [],
  missingInformation: [],
  confidence: 0.8,
}

function aiLowReport() {
  return {
    report: {
      overallScore: 85,
      riskLevel: "Low",
      categories: {
        terms: { score: 85, severity: "low", findings: [], mitigations: "" },
      },
      summary: "Looks fine.",
      recommendations: ["Sign it."],
    },
    usedFallback: false,
  }
}

function aiHighReport() {
  return {
    report: {
      overallScore: 20,
      riskLevel: "High",
      categories: {
        terms: { score: 20, severity: "high", findings: [], mitigations: "" },
      },
      summary: "Risky.",
      recommendations: ["Be careful."],
    },
    usedFallback: false,
  }
}

// Phase 21 authority boundary: deterministic FAIL + AI LOW → deterministic
// failure remains authoritative; deterministic PASS + AI HIGH → AI advisory
// is preserved without fabricating a deterministic failure.
describe("risk authority boundary (Phase 21, founder Phase 22, partnership Phase 25)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true })
    mockNegotiationPointsFn.mockResolvedValue(["Ask about the cap"])
  })

  it("Case 1: deterministic material FAIL stays authoritative when AI says Low", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const audits = auditsQuery(
      {
        id: "audit-lease-1",
        ai_consent: true,
        raw_input: "12-month shop lease. $1,000 monthly rent. Tenant liable for all repairs with no cap stated.",
        structured_data: { files: [] },
        deal_type: "lease",
        context_envelope: null,
      },
      [{ id: "audit-lease-1" }]
    )
    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQb() : table === "audits" ? audits : qb()))
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: mockExtractedData })
    mockAnalyzeGenericRiskFn.mockResolvedValue(aiLowReport())

    const result = await analyzeDeal("audit-lease-1")

    expect(result.success).toBe(true)
    const flagged = (result.deterministicFindings ?? []).find((r) => r.ruleKey === "lease-liability-uncapped")
    expect(flagged?.status).toBe("FAIL")
    expect(flagged?.finding?.evidence?.length).toBeGreaterThan(0)
    // The AI Low must not hide the material FAIL: headline floors at High.
    const report = result.riskReport as { overallScore: number; riskLevel: string }
    expect(report.overallScore).toBe(20)
    expect(report.riskLevel).toBe("High")
  })

  it("Case 2: deterministic PASS is not converted into failure when AI says High", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const audits = auditsQuery(
      {
        id: "audit-lease-2",
        ai_consent: true,
        raw_input:
          "$2,400 monthly rent. 12-month lease term. Break clause with 3 months notice. $500 security deposit. Tenant handles maintenance and repairs. Annual market rent review. Permitted use as office.",
        structured_data: { files: [] },
        deal_type: "lease",
        context_envelope: null,
      },
      [{ id: "audit-lease-2" }]
    )
    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQb() : table === "audits" ? audits : qb()))
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: mockExtractedData })
    mockAnalyzeGenericRiskFn.mockResolvedValue(aiHighReport())

    const result = await analyzeDeal("audit-lease-2")

    expect(result.success).toBe(true)
    // No deterministic failure is fabricated: no lease-scoped rule FAILs
    // here (unscoped builtin informational checks may still fire and do not
    // affect the floor).
    const fails = (result.deterministicFindings ?? []).filter(
      (r) => r.status === "FAIL" && r.ruleKey.startsWith("lease-")
    )
    expect(fails).toEqual([])
    // AI advisory High is preserved, not rewritten into a deterministic Low.
    const report = result.riskReport as { overallScore: number; riskLevel: string }
    expect(report.riskLevel).toBe("High")
  })

  it("Founder Case 1: deterministic material FAIL stays authoritative when AI says Low", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const audits = auditsQuery(
      {
        id: "audit-founder-1",
        ai_consent: true,
        raw_input: "Alice and Bob split ownership 50/50. Founders are liable for all company losses with no cap.",
        structured_data: { files: [] },
        deal_type: "founder",
        context_envelope: null,
      },
      [{ id: "audit-founder-1" }]
    )
    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQb() : table === "audits" ? audits : qb()))
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: mockExtractedData })
    mockAnalyzeGenericRiskFn.mockResolvedValue(aiLowReport())

    const result = await analyzeDeal("audit-founder-1")

    expect(result.success).toBe(true)
    const flagged = (result.deterministicFindings ?? []).find((r) => r.ruleKey === "founder-liability-uncapped")
    expect(flagged?.status).toBe("FAIL")
    const report = result.riskReport as { overallScore: number; riskLevel: string }
    expect(report.overallScore).toBe(20)
    expect(report.riskLevel).toBe("High")
  })

  it("Founder Case 2: deterministic PASS is not converted into failure when AI says High", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const audits = auditsQuery(
      {
        id: "audit-founder-2",
        ai_consent: true,
        raw_input:
          "Alice is CEO and Bob is CTO. Ownership split 60/40. Four-year vesting with a one-year cliff. All IP is assigned to the company. Board decides by majority vote with reserved matters needing consent. Leaver shares are repurchased. Share transfers need board consent.",
        structured_data: { files: [] },
        deal_type: "founder",
        context_envelope: null,
      },
      [{ id: "audit-founder-2" }]
    )
    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQb() : table === "audits" ? audits : qb()))
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: mockExtractedData })
    mockAnalyzeGenericRiskFn.mockResolvedValue(aiHighReport())

    const result = await analyzeDeal("audit-founder-2")

    expect(result.success).toBe(true)
    const fails = (result.deterministicFindings ?? []).filter(
      (r) => r.status === "FAIL" && r.ruleKey.startsWith("founder-")
    )
    expect(fails).toEqual([])
    const report = result.riskReport as { overallScore: number; riskLevel: string }
    expect(report.riskLevel).toBe("High")
  })

  it("Partnership Case 1: deterministic material FAIL stays authoritative when AI says Low", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const audits = auditsQuery(
      {
        id: "audit-partnership-1",
        ai_consent: true,
        raw_input: "Alice and Bob split profits 50/50. Partners are liable for all partnership debts with no cap.",
        structured_data: { files: [] },
        deal_type: "partnership",
        context_envelope: null,
      },
      [{ id: "audit-partnership-1" }]
    )
    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQb() : table === "audits" ? audits : qb()))
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: mockExtractedData })
    mockAnalyzeGenericRiskFn.mockResolvedValue(aiLowReport())

    const result = await analyzeDeal("audit-partnership-1")

    expect(result.success).toBe(true)
    const flagged = (result.deterministicFindings ?? []).find((r) => r.ruleKey === "partnership-liability-uncapped")
    expect(flagged?.status).toBe("FAIL")
    const report = result.riskReport as { overallScore: number; riskLevel: string }
    expect(report.overallScore).toBe(20)
    expect(report.riskLevel).toBe("High")
  })

  it("Partnership Case 2: deterministic PASS is not converted into failure when AI says High", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const audits = auditsQuery(
      {
        id: "audit-partnership-2",
        ai_consent: true,
        raw_input:
          "Alice is managing partner and Bob is limited partner. Profits split 60/40. Each partner contributes $50,000 in initial capital. Profits are distributed quarterly. The managing partner runs day-to-day operations. Decisions need a majority vote with reserved matters needing consent. A departing partner's interest is bought out at fair value. Transferring an interest needs the other partners' consent.",
        structured_data: { files: [] },
        deal_type: "partnership",
        context_envelope: null,
      },
      [{ id: "audit-partnership-2" }]
    )
    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQb() : table === "audits" ? audits : qb()))
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: mockExtractedData })
    mockAnalyzeGenericRiskFn.mockResolvedValue(aiHighReport())

    const result = await analyzeDeal("audit-partnership-2")

    expect(result.success).toBe(true)
    const fails = (result.deterministicFindings ?? []).filter(
      (r) => r.status === "FAIL" && r.ruleKey.startsWith("partnership-")
    )
    expect(fails).toEqual([])
    const report = result.riskReport as { overallScore: number; riskLevel: string }
    expect(report.riskLevel).toBe("High")
  })
})
