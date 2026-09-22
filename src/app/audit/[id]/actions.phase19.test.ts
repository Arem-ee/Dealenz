/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())
const mockExtractAndValidate = vi.hoisted(() => vi.fn())
const mockStorageFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
    storage: { from: mockStorageFrom },
  })),
}))

vi.mock("@/lib/ai/extract", () => ({
  extractProjectData: vi.fn(),
  extractAndValidate: mockExtractAndValidate,
}))

vi.mock("@/lib/ai/risk-analysis", () => ({
  analyzeRisk: vi.fn(),
  analyzeGenericRiskWithVisibleFailure: vi.fn().mockResolvedValue({ report: { overallScore: 70, riskLevel: "Medium", categories: {}, summary: "ok", recommendations: [] } }),
}))

vi.mock("@/lib/ai/negotiation", () => ({
  generateNegotiationPoints: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/lib/generate", () => ({
  generateDocuments: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  logEvent: vi.fn(),
  logDuration: vi.fn(() => 100),
  reportError: vi.fn(),
  reportAIFallback: vi.fn(),
}))

import { analyzeDeal, removeFileMetadata, markDocumentReviewed } from "./actions"

const mockUser = { id: "00000000-0000-0000-0000-000000000001", email: "test@test.com", email_confirmed_at: "2024-01-01" }

function qbAudit(auditRow: any, lockRows: any[] = [{ id: "audit-1" }]) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: auditRow, error: null })),
    update: vi.fn(() => builder),
    then: (resolve: any) => resolve({ data: null, error: null }),
  }
  let updated = false
  const origUpdate = builder.update
  builder.update = vi.fn(() => {
    updated = true
    return builder
  })
  const terminalSelect = vi.fn(() => {
    if (updated) return Promise.resolve({ data: lockRows, error: null })
    return builder
  })
  builder.select = terminalSelect as any
  return builder
}

describe("Phase19 — credit-gated analyses (free allowance retired)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockRpc.mockResolvedValue({ data: [{ allowed: true, current_count: 1 }], error: null })
  })

  it("never consults the usage allowance, even when the usage RPC would deny", async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ allowed: false, current_count: 99 }], error: null })
    const audits = qbAudit({ id: "audit-1", ai_consent: true, raw_input: "hello", structured_data: { files: [] } })
    mockFrom.mockImplementation((table: string) => {
      if (table === "audits") return audits as never
      if (table === "user_ai_consents") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: { has_consented_to_ai_analysis: true }, error: null })) })) })) } as never
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })) })) } as never
    })
    const result = await analyzeDeal("audit-1").catch(() => null)
    void result
    const gated = mockRpc.mock.calls.filter(([fn]) => fn === "increment_usage")
    expect(gated).toHaveLength(0)
  })

  it("never consults the usage allowance, even when the usage RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "db down" } })
    const audits = qbAudit({ id: "audit-1", ai_consent: true, raw_input: "hello", structured_data: { files: [] } })
    mockFrom.mockImplementation((table: string) => {
      if (table === "audits") return audits as never
      if (table === "user_ai_consents") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: { has_consented_to_ai_analysis: true }, error: null })) })) })) } as never
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })) })) } as never
    })
    const result2 = await analyzeDeal("audit-1").catch(() => null)
    void result2
    const gated2 = mockRpc.mock.calls.filter(([fn]) => fn === "increment_usage")
    expect(gated2).toHaveLength(0)
  })
})

describe("Phase19 — storage trust (F-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
  })

  it("rejects wrong storage prefix", async () => {
    await expect(removeFileMetadata("00000000-0000-0000-0000-000000000001", "audit-files/other-user/audit-1/file.pdf")).rejects.toThrow(/Invalid file path/)
  })

  it("rejects unauthenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(removeFileMetadata("00000000-0000-0000-0000-000000000001", "audit-files/00000000-0000-0000-0000-000000000001/audit-1/file.pdf")).rejects.toThrow(/Unauthorized/)
  })
})
