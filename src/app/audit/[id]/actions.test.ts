import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { RiskReport } from "@/lib/risk/engine"
import type { ExtractedData } from "@/lib/ai/extract"

// ── Hoisted shared mocks ──

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())
const mockStorageFrom = vi.hoisted(() => vi.fn())
const mockCheckRateLimit = vi.hoisted(() => vi.fn())
const mockExtractProjectData = vi.hoisted(() => vi.fn())
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
  extractProjectData: mockExtractProjectData,
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

import {
  analyzeDeal,
  generateProtectionPackage,
  createShareToken,
  revokeShareToken,
  getShareStatus,
} from "./actions"

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

// Default: usage RPC allows the call (mirrors increment_usage default-allow under limit)
mockRpc.mockResolvedValue({ data: { allowed: true, current_count: 1 }, error: null })

// ── Stateful audits-table builder ──
// The implementation hits from("audits") three times per flow:
//   read   = select("*").eq().eq().single()            → resolves the audit row
//   lock   = update().eq().eq().or().select("id")      → resolves lockRows
//   update = update().eq() (awaited thenable)           → resolves default
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

function consentedMock() {
  const b = qb({ data: { has_consented_to_ai_analysis: true }, error: null })
  b.maybeSingle = vi.fn().mockResolvedValue({ data: { has_consented_to_ai_analysis: true }, error: null })
  return b
}

// ── Test data ──

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

const mockRiskReport: RiskReport = {
  overallScore: 72,
  riskLevel: "Medium",
  summary: "Medium risk",
  categories: {
    scopeRisk: { score: 70, severity: "medium", findings: [], mitigations: "" },
    paymentRisk: { score: 50, severity: "low", findings: [], mitigations: "" },
    timelineRisk: { score: 60, severity: "medium", findings: [], mitigations: "" },
    communicationRisk: { score: 80, severity: "low", findings: [], mitigations: "" },
    revisionRisk: { score: 40, severity: "low", findings: [], mitigations: "" },
    legalRisk: { score: 75, severity: "low", findings: [], mitigations: "" },
    ipRisk: { score: 85, severity: "low", findings: [], mitigations: "" },
    clientBehaviorRisk: { score: 90, severity: "low", findings: [], mitigations: "" },
  },
  recommendations: [],
}

// ── Tests ──

describe("analyzeDeal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true })
  })

  it("returns success with data and risk report for valid input", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const audits = auditsQuery(
      { id: "audit-1", ai_consent: true, raw_input: "Build a website", structured_data: { files: [] } },
      [{ id: "audit-1" }]
    )
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_ai_consents") return consentedMock() as never
      return (table === "audits" ? audits : qb()) as never
    })
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: mockExtractedData })
    mockAnalyzeRiskFn.mockResolvedValue({ report: mockRiskReport, usedFallback: false })

    const result = await analyzeDeal("audit-1")

    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockExtractedData)
    expect(result.riskReport).toEqual(mockRiskReport)
  })

  it("returns error when audit has no input content", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const audits = auditsQuery(
      { id: "audit-1", ai_consent: true, raw_input: "", structured_data: { files: [] } },
      [{ id: "audit-1" }]
    )
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_ai_consents") return consentedMock() as never
      return (table === "audits" ? audits : qb()) as never
    })

    const result = await analyzeDeal("audit-1")
    expect(result.success).toBe(false)
    expect(result.error).toContain("No content to analyze")
  })

  it("returns error when audit is locked by another process", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const audits = auditsQuery(
      { id: "audit-1", ai_consent: true, raw_input: "test", structured_data: { files: [] } },
      [] // empty → lock fails
    )
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_ai_consents") return consentedMock() as never
      return (table === "audits" ? audits : qb()) as never
    })

    const result = await analyzeDeal("audit-1")
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/currently being analyzed|lock/i)
  })

  it("runs lease audits through the generic path with lease findings, never the freelance engine", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const audits = auditsQuery(
      {
        id: "audit-lease-1",
        ai_consent: true,
        raw_input: "Shop lease, 12 month term. Subletting requires landlord consent.",
        structured_data: { files: [] },
        deal_type: "lease",
        context_envelope: null,
      },
      [{ id: "audit-lease-1" }]
    )
    mockFrom.mockImplementation((table: string) => {
      if (table === "user_ai_consents") return consentedMock() as never
      return (table === "audits" ? audits : qb()) as never
    })
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: mockExtractedData })
    mockAnalyzeGenericRiskFn.mockResolvedValue({
      report: {
        overallScore: 65,
        riskLevel: "Medium",
        categories: {},
        summary: "Generic lease review",
        recommendations: [],
      },
      usedFallback: false,
    })
    mockNegotiationPointsFn.mockResolvedValue(["Ask about renewal terms"])

    const result = await analyzeDeal("audit-lease-1")

    expect(result.success).toBe(true)
    // Freelance deterministic engine must not run on a lease.
    expect(mockAnalyzeRiskFn).not.toHaveBeenCalled()
    const findingKeys = (result.deterministicFindings ?? []).map((r) => r.ruleKey)
    expect(findingKeys).toContain("lease-termination-notice-missing")
    expect(findingKeys.some((k) => k.startsWith("freelance-"))).toBe(false)
    // Negotiation synthesis is included for lease exactly like generic.
    expect(mockNegotiationPointsFn).toHaveBeenCalledTimes(1)
    // Synthesis receives every FAIL finding: no silent truncation between
    // evaluation and the negotiation prompt.
    const failKeys = (result.deterministicFindings ?? [])
      .filter((r) => r.status === "FAIL")
      .map((r) => r.ruleKey)
      .sort()
    const negotiatedKeys = (
      mockNegotiationPointsFn.mock.calls[0][3] as Array<{ ruleKey: string }>
    )
      .map((f) => f.ruleKey)
      .sort()
    expect(negotiatedKeys).toEqual(failKeys)
    // Findings persist into structured_data so the workspace can render them
    // on reload without re-running evaluation.
    const updates = (audits.update as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0])
    const persisted = updates.find(
      (update): update is { structured_data: { deterministicFindings: Array<{ ruleKey: string }> } } => {
        if (typeof update !== "object" || update === null) return false
        const structured = (update as Record<string, unknown>).structured_data
        return (
          typeof structured === "object" &&
          structured !== null &&
          Array.isArray((structured as Record<string, unknown>).deterministicFindings)
        )
      }
    )
    expect(persisted).toBeDefined()
    expect(persisted?.structured_data.deterministicFindings.map((r) => r.ruleKey)).toContain(
      "lease-termination-notice-missing"
    )
    // Enriched findings carry audit-bound evidence for later inspection.
    const flagged = (result.deterministicFindings ?? []).find((r) => r.ruleKey === "lease-subletting-terms-present")
    expect(flagged?.status).toBe("FAIL")
    expect(flagged?.finding?.evidence?.length).toBeGreaterThan(0)
    expect(flagged?.finding?.evidence?.[0].sourceType).toBe("audit_input")
    expect(flagged?.finding?.evidence?.[0].sourceId).toBe("audit-lease-1")
    expect(flagged?.finding?.evidence?.[0].quote).toMatch(/sublet/i)
  })
})

describe("generateProtectionPackage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true })
  })

  it("generates documents on valid audit with extracted data and risk report", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const auditQuery = qb()
    auditQuery.single = vi.fn().mockResolvedValueOnce({
      data: { id: "audit-1", structured_data: { extractedData: mockExtractedData }, risk_report: mockRiskReport },
      error: null,
    })
    auditQuery.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    auditQuery.limit = vi.fn(() => auditQuery)
    auditQuery.update = vi.fn(() => auditQuery)
    const consentQuery = qb({ data: { has_consented_to_ai_analysis: true }, error: null })
    consentQuery.maybeSingle = vi.fn().mockResolvedValue({ data: { has_consented_to_ai_analysis: true }, error: null })

    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQuery : auditQuery) as never)

    mockGenerateDocuments.mockResolvedValue({
      proposal: { content: "# Proposal", method: "ai" },
      sow: { content: "# SOW", method: "ai" },
      contract: { content: "# Contract", method: "template" },
      checklist: { content: "# Checklist", method: "ai" },
    })

    const result = await generateProtectionPackage("audit-1")

    expect(result.success).toBe(true)
    expect(result.documents).toHaveLength(4)
    expect(result.documents!.some(d => d.type === "proposal")).toBe(true)
    expect(result.documents!.some(d => d.type === "sow")).toBe(true)
    expect(result.documents!.some(d => d.type === "contract")).toBe(true)
    expect(result.documents!.some(d => d.type === "checklist")).toBe(true)
  })

  it("returns fallback documents when all AI generation uses templates", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const auditQuery = qb()
    auditQuery.single = vi.fn().mockResolvedValueOnce({
      data: { id: "audit-1", structured_data: { extractedData: mockExtractedData }, risk_report: mockRiskReport },
      error: null,
    })
    auditQuery.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    auditQuery.limit = vi.fn(() => auditQuery)
    auditQuery.update = vi.fn(() => auditQuery)
    const consentQuery = qb({ data: { has_consented_to_ai_analysis: true }, error: null })
    consentQuery.maybeSingle = vi.fn().mockResolvedValue({ data: { has_consented_to_ai_analysis: true }, error: null })

    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQuery : auditQuery) as never)

    mockGenerateDocuments.mockResolvedValue({
      proposal: { content: "# Proposal (template)", method: "template" },
      sow: { content: "# SOW (template)", method: "template" },
      contract: { content: "# Contract (template)", method: "template" },
      checklist: { content: "# Checklist (template)", method: "template" },
    })

    const result = await generateProtectionPackage("audit-1")
    expect(result.success).toBe(true)
    expect(result.documents).toHaveLength(4)
  })

  it("returns error when audit has no extracted data", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const auditQuery = qb()
    auditQuery.single = vi.fn().mockResolvedValueOnce({
      data: { id: "audit-1", structured_data: {}, risk_report: null },
      error: null,
    })
    const consentQuery = qb({ data: { has_consented_to_ai_analysis: true }, error: null })
    consentQuery.maybeSingle = vi.fn().mockResolvedValue({ data: { has_consented_to_ai_analysis: true }, error: null })

    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQuery : auditQuery) as never)

    const result = await generateProtectionPackage("audit-1")
    expect(result.success).toBe(false)
    expect(result.error).toContain("Complete the audit analysis")
  })
})

describe("createShareToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://dealenz.com")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("creates a share token successfully", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const query = qb()
    query.is = vi.fn(() => query)
    query.maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: { id: "audit-1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    query.update = vi.fn(() => query)
    query.insert = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockReturnValue(query)

    const result = await createShareToken("audit-1", "proposal")

    expect(result.success).toBe(true)
    expect(result.token).toBeDefined()
    expect(typeof result.token).toBe("string")
    expect(result.shareUrl).toContain("https://dealenz.com/view/")
  })

  it("rejects invalid document type", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockFrom.mockReturnValue(qb())

    const result = await createShareToken("audit-1", "invalid-type" as unknown as "proposal" | "sow" | "contract" | "checklist")
    expect(result.success).toBe(false)
    expect(result.error).toContain("Invalid document type")
  })

  it("applies 30-day expiry to new tokens", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    let insertedExpiry: string | null = null
    const query = qb()
    query.is = vi.fn(() => query)
    query.maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: { id: "audit-1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    query.update = vi.fn(() => query)
    query.insert = vi.fn((data: Record<string, unknown>) => {
      insertedExpiry = data.expires_at as string
      return Promise.resolve({ error: null })
    }) as unknown as typeof query.insert

    mockFrom.mockReturnValue(query)

    await createShareToken("audit-1", "sow")

    expect(insertedExpiry).toBeDefined()
    const expiresAt = new Date(insertedExpiry!)
    const now = new Date()
    const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeGreaterThan(28)
    expect(diffDays).toBeLessThan(31)
  })
})

describe("revokeShareToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("revokes an active share token", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const query = qb()
    query.maybeSingle = vi.fn().mockResolvedValue({ data: { user_id: "user-1" }, error: null })
    query.update = vi.fn(() => query)
    mockFrom.mockReturnValue(query)

    const result = await revokeShareToken("00000000-0000-0000-0000-000000000010")
    expect(result.success).toBe(true)
  })
})

describe("getShareStatus — signing flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns signature data when document is signed", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const tokens: Array<Record<string, unknown>> = [
      {
        id: "token-1",
        document_type: "proposal",
        token: "abc123",
        created_at: "2024-01-01T00:00:00Z",
        expires_at: "2024-02-01T00:00:00Z",
        revoked_at: null,
        document_signatures: [
          { signed_by_name: "Alice", signed_by_email: "alice@test.com", signed_at: "2024-01-15T00:00:00Z" },
        ],
      },
    ]
    const query = qb({ data: tokens, error: null })
    query.order = vi.fn(() => query)
    query.maybeSingle = vi.fn().mockResolvedValueOnce({ data: { id: "audit-1" }, error: null })

    mockFrom.mockReturnValue(query)

    const result = await getShareStatus("00000000-0000-0000-0000-000000000001")

    expect(result.success).toBe(true)
    expect(result.tokens!.length).toBe(1)
    expect(result.tokens![0]!.signature).not.toBeNull()
    expect(result.tokens![0]!.signature!.signed_by_name).toBe("Alice")
    expect(result.tokens![0]!.signature!.signed_by_email).toBe("alice@test.com")
  })

  it("returns null signature when document is not signed", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })

    const tokens: Array<Record<string, unknown>> = [
      {
        id: "token-1",
        document_type: "proposal",
        token: "abc123",
        created_at: "2024-01-01T00:00:00Z",
        expires_at: "2024-02-01T00:00:00Z",
        revoked_at: null,
        document_signatures: [],
      },
    ]
    const query = qb({ data: tokens, error: null })
    query.order = vi.fn(() => query)
    query.maybeSingle = vi.fn().mockResolvedValueOnce({ data: { id: "audit-1" }, error: null })

    mockFrom.mockReturnValue(query)

    const result = await getShareStatus("00000000-0000-0000-0000-000000000001")

    expect(result.success).toBe(true)
    expect(result.tokens!.length).toBe(1)
    expect(result.tokens![0]!.signature).toBeNull()
  })
})
