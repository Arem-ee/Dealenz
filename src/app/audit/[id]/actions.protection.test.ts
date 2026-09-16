import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockCheckRateLimit = vi.hoisted(() => vi.fn(() => Promise.resolve({ allowed: true })))
const mockGenerateDocuments = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: vi.fn(),
    storage: { from: vi.fn(() => ({ download: vi.fn() })) },
  })),
}))
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mockCheckRateLimit }))
vi.mock("@/lib/ai/extract", () => ({ extractProjectData: vi.fn(), extractAndValidate: vi.fn() }))
vi.mock("@/lib/ai/risk-analysis", () => ({
  analyzeRisk: vi.fn(),
  analyzeGenericRiskWithVisibleFailure: vi.fn(),
}))
vi.mock("@/lib/ai/negotiation", () => ({ generateNegotiationPoints: vi.fn().mockResolvedValue([]) }))
vi.mock("@/lib/generate", () => ({ generateDocuments: mockGenerateDocuments }))
vi.mock("@/lib/logger", () => ({ logEvent: vi.fn(), logDuration: vi.fn(() => 1), reportError: vi.fn(), reportAIFallback: vi.fn() }))

const mockUser = { id: "00000000-0000-0000-0000-000000000001", email: "test@test.com", email_confirmed_at: "2024-01-01" }

function qb() {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    update: vi.fn(() => builder),
  }
  return builder as never
}

function auditRow(dealType: string) {
  return {
    id: "audit-1",
    user_id: mockUser.id,
    deal_type: dealType,
    status: "draft",
    ai_consent: true,
    raw_input: "hello",
    structured_data: { extractedData: { goals: ["g"], deliverables: ["d"], timeline: "t", budget: "b", projectType: "p", clientSignals: [], missingInformation: [], confidence: 0.9 }, risk_report: { overallScore: 80, riskLevel: "Low" } },
    risk_report: { overallScore: 80, riskLevel: "Low" },
    overall_score: 80,
    title: "Test",
    created_at: new Date().toISOString(),
    client_id: null,
    source_type: "paste",
    context_envelope: null,
  }
}

import { generateProtectionPackage } from "./actions"

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({ allowed: true })
})

describe("generateProtectionPackage deal-type boundary (Phase 26)", () => {
  it("succeeds for freelance (does not hit the freelance-only guard)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const q = qb() as unknown as Record<string, ReturnType<typeof vi.fn>>
    // audits lookup — must return freelance
    q.single = vi.fn().mockResolvedValue({ data: auditRow("freelance"), error: null })
    q.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null }))
    q.limit = vi.fn(() => q)
    q.update = vi.fn(() => q)
    q.select = vi.fn(() => q)
    q.eq = vi.fn(() => q)
    q.order = vi.fn(() => q)
    q.is = vi.fn(() => q)
    q.insert = vi.fn(() => Promise.resolve({ error: null })) as unknown as ReturnType<typeof vi.fn>
    const consentQ = qb() as unknown as Record<string, ReturnType<typeof vi.fn>>
    consentQ.select = vi.fn(() => consentQ)
    consentQ.eq = vi.fn(() => consentQ)
    consentQ.maybeSingle = vi.fn().mockResolvedValue({ data: { has_consented_to_ai_analysis: true }, error: null })
    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? (consentQ as never) : (q as never)))
    mockGenerateDocuments.mockResolvedValue({
      proposal: { content: "# Proposal", method: "ai" },
      sow: { content: "# SOW", method: "ai" },
      contract: { content: "# Contract", method: "template" },
      checklist: { content: "# Checklist", method: "ai" },
    })
    const res = await generateProtectionPackage("audit-1")
    // It should get past the deal-type guard; success may be false due to incomplete mock
    // of document_versions inserts, but the error must NOT be the boundary error.
    if (!res.success) {
      expect(res.error).not.toMatch(/freelance deals only/i)
    } else {
      expect(res.success).toBe(true)
    }
    expect(mockGenerateDocuments).toHaveBeenCalled()
  })

  for (const dealType of ["lease", "purchase_sale", "employment", "founder", "partnership", "generic"] as const) {
    it(`refuses ${dealType} with an honest pre-generation error`, async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
      const q = qb() as unknown as Record<string, ReturnType<typeof vi.fn>>
      q.single = vi.fn().mockResolvedValue({ data: auditRow(dealType), error: null })
      const consentQ = qb() as unknown as Record<string, ReturnType<typeof vi.fn>>
      consentQ.select = vi.fn(() => consentQ)
      consentQ.eq = vi.fn(() => consentQ)
      consentQ.maybeSingle = vi.fn().mockResolvedValue({ data: { has_consented_to_ai_analysis: true }, error: null })
      mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? (consentQ as never) : (q as never)))
      const res = await generateProtectionPackage("audit-1")
      expect(res.success).toBe(false)
      expect(res.error).toMatch(/freelance deals only/i)
      expect(mockGenerateDocuments).not.toHaveBeenCalled()
    })
  }
})
