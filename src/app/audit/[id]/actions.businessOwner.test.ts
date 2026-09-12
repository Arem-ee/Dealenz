import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockCheckRateLimit = vi.hoisted(() => vi.fn(() => Promise.resolve({ allowed: true })))

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
vi.mock("@/lib/ai/risk-analysis", () => ({ analyzeRisk: vi.fn(), analyzeGenericRiskWithVisibleFailure: vi.fn() }))
vi.mock("@/lib/ai/negotiation", () => ({ generateNegotiationPoints: vi.fn().mockResolvedValue([]) }))
vi.mock("@/lib/generate", () => ({ generateDocuments: vi.fn() }))
vi.mock("@/lib/logger", () => ({ logEvent: vi.fn(), logDuration: vi.fn(() => 1), reportError: vi.fn(), reportAIFallback: vi.fn() }))

const mockUser = { id: "00000000-0000-0000-0000-000000000001", email: "test@test.com", email_confirmed_at: "2024-01-01" }

function qb() {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    update: vi.fn(() => builder),
  }
  return builder as never
}

function auditRow(dealType: string) {
  return {
    id: "00000000-0000-0000-0000-000000000011",
    user_id: mockUser.id,
    deal_type: dealType,
    status: "analyzed",
    ai_consent: true,
    raw_input: "founder deal with Alice and Bob",
    structured_data: {
      deterministicFindings: [
        {
          ruleKey: "founder-ownership-split-missing",
          ruleVersion: "v1",
          status: "FAIL",
          finding: { ruleKey: "founder-ownership-split-missing", ruleVersion: 1, summary: "No ownership split", severity: "attention", guidance: "Write it down", authority: { kind: "product_policy", note: "n" } },
          reason: "fired",
          authority: { kind: "product_policy", note: "n" },
          evaluatedAt: new Date().toISOString(),
        },
      ],
    },
    risk_report: { overallScore: 40, riskLevel: "High" },
    overall_score: 40,
    title: "Test",
    created_at: new Date().toISOString(),
    client_id: null,
    source_type: "paste",
    context_envelope: null,
  }
}

import { generateBusinessOwnerDraft } from "./actions"
import { reportError } from "@/lib/logger"

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({ allowed: true })
})

describe("generateBusinessOwnerDraft — international business-owner generation", () => {
  it("generates a founder draft with Nigeria jurisdiction and preserves provenance", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const q = qb() as unknown as Record<string, ReturnType<typeof vi.fn>>
    q.single = vi.fn().mockResolvedValue({ data: auditRow("founder"), error: null })
    q.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(q as never)
    const res = await generateBusinessOwnerDraft("00000000-0000-0000-0000-000000000011", "founder-agreement", "Nigeria", { company_name: "Acme Ltd", founder_names: "Alice and Bob", ownership_percentages: "60/40" })
    expect(res.success).toBe(true)
    expect(res.draft).toBeDefined()
    expect(res.draft!.title).toBe("Founder Agreement")
    expect(res.draft!.provenance.jurisdiction.country).toBe("Nigeria")
    expect(res.draft!.provenance.dealType).toBe("founder")
    expect(res.draft!.citations.length).toBeGreaterThan(0)
    expect(res.draft!.markdown).toContain("Acme Ltd")
    expect(res.draft!.markdown).toContain("drafting assistance")
  })

  it("generates a partnership LLP draft and distinguishes Testland fixture (proves neutrality)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const partnershipAudit = { ...auditRow("partnership"), raw_input: "LLP agreement between Alice and Bob", structured_data: { deterministicFindings: [] } }
    const q = qb() as unknown as Record<string, ReturnType<typeof vi.fn>>
    q.single = vi.fn().mockResolvedValue({ data: partnershipAudit, error: null })
    q.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(q as never)
    const nigeria = await generateBusinessOwnerDraft("00000000-0000-0000-0000-000000000011", "llp-agreement", "Nigeria", { partner_names: "Alice and Bob" })
    expect(nigeria.success).toBe(true)
    expect(nigeria.draft!.citations.length).toBeGreaterThan(0)
    const testland = await generateBusinessOwnerDraft("00000000-0000-0000-0000-000000000011", "llp-agreement", "Testland", { partner_names: "Alice and Bob" })
    expect(testland.success).toBe(true)
    expect(testland.draft!.citations.length).toBe(0)
    expect(testland.draft!.markdown).toContain("Testland is a synthetic fixture")
    expect(testland.draft!.provenance.citations.length).toBe(0)
    expect(testland.draft!.provenance.jurisdiction.country).toBe("Testland")
  })

  it("requires jurisdiction — does not silently choose", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const res = await generateBusinessOwnerDraft("00000000-0000-0000-0000-000000000011", "founder-agreement", "", {})
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/Jurisdiction is required/)
  })

  it("founder cannot use partnership family and partnership cannot use founder family", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const q = qb() as unknown as Record<string, ReturnType<typeof vi.fn>>
    q.single = vi.fn().mockResolvedValue({ data: auditRow("founder"), error: null })
    mockFrom.mockReturnValue(q as never)
    const res = await generateBusinessOwnerDraft("00000000-0000-0000-0000-000000000011", "partnership-agreement", "Nigeria", {})
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/does not support deal type/)
  })

  it("preserves missing variables as {{var}} and never invents", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const q = qb() as unknown as Record<string, ReturnType<typeof vi.fn>>
    q.single = vi.fn().mockResolvedValue({ data: auditRow("founder"), error: null })
    q.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(q as never)
    const res = await generateBusinessOwnerDraft("00000000-0000-0000-0000-000000000011", "founder-agreement", "Nigeria", {})
    expect(res.success).toBe(true)
    expect(res.draft!.missingVariables.length).toBeGreaterThan(0)
    expect(res.draft!.markdown).toContain("{{")
    expect(res.draft!.markdown).toContain("UNKNOWN")
    expect(res.draft!.markdown).not.toMatch(/invented value/i)
  })

  it("freelance cannot silently use business-owner generator for founder families", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const q = qb() as unknown as Record<string, ReturnType<typeof vi.fn>>
    q.single = vi.fn().mockResolvedValue({ data: auditRow("freelance"), error: null })
    mockFrom.mockReturnValue(q as never)
    const res = await generateBusinessOwnerDraft("00000000-0000-0000-0000-000000000011", "founder-agreement", "Nigeria", {})
    expect(res.success).toBe(false)
  })

  it("generates a Tier 2 purchase terms sheet with US-grounded citations", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const purchaseAudit = { ...auditRow("purchase_sale"), raw_input: "sale of 100 widgets for $50,000", structured_data: { deterministicFindings: [] } }
    const q = qb() as unknown as Record<string, ReturnType<typeof vi.fn>>
    q.single = vi.fn().mockResolvedValue({ data: purchaseAudit, error: null })
    q.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(q as never)
    const res = await generateBusinessOwnerDraft("00000000-0000-0000-0000-000000000011", "purchase-terms-sheet", "United States", { purchase_price: "50,000", currency: "USD" })
    expect(res.success).toBe(true)
    expect(res.draft!.title).toBe("Purchase Terms Sheet")
    expect(res.draft!.provenance.dealType).toBe("purchase_sale")
    expect(res.draft!.provenance.jurisdiction.country).toBe("United States")
    expect(res.draft!.citations.length).toBeGreaterThan(0)
    expect(res.draft!.citations.every((c) => c.jurisdiction === "United States")).toBe(true)
    expect(res.draft!.markdown).toContain("50,000")
    expect(res.draft!.markdown).toContain("drafting assistance")
  })

  it("Tier 2 lease audit cannot use the purchase family (vertical isolation)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const q = qb() as unknown as Record<string, ReturnType<typeof vi.fn>>
    q.single = vi.fn().mockResolvedValue({ data: auditRow("lease"), error: null })
    mockFrom.mockReturnValue(q as never)
    const res = await generateBusinessOwnerDraft("00000000-0000-0000-0000-000000000011", "purchase-terms-sheet", "United States", {})
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/does not support deal type/)
  })

  it("still returns the draft when persistence fails, but records it visibly", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const q = qb() as unknown as Record<string, ReturnType<typeof vi.fn>>
    q.single = vi.fn().mockResolvedValue({ data: auditRow("founder"), error: null })
    q.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    q.insert = vi.fn().mockResolvedValue({ error: { message: "connection reset" } })
    mockFrom.mockReturnValue(q as never)
    const res = await generateBusinessOwnerDraft("00000000-0000-0000-0000-000000000011", "founder-agreement", "Nigeria", {})
    expect(res.success).toBe(true)
    expect(res.draft).toBeDefined()
    expect(vi.mocked(reportError)).toHaveBeenCalledTimes(1)
    const call = vi.mocked(reportError).mock.calls[0]![1] as { phase?: unknown; severity?: unknown }
    expect(call.phase).toBe("business_owner_draft_persist")
    expect(call.severity).toBe("warn")
  })

  it("retries once with a fresh version on unique collisions", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const q = qb() as unknown as Record<string, ReturnType<typeof vi.fn>>
    q.single = vi.fn().mockResolvedValue({ data: auditRow("founder"), error: null })
    q.maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { version_number: 4 }, error: null })
    const insertMock = vi.fn()
      .mockResolvedValueOnce({ error: { message: 'duplicate key value violates unique constraint "uq_document_version"' } })
      .mockResolvedValueOnce({ error: null })
    q.insert = insertMock
    mockFrom.mockReturnValue(q as never)
    const res = await generateBusinessOwnerDraft("00000000-0000-0000-0000-000000000011", "founder-agreement", "Nigeria", {})
    expect(res.success).toBe(true)
    expect(insertMock).toHaveBeenCalledTimes(2)
    expect(vi.mocked(reportError)).not.toHaveBeenCalled()
  })
})
