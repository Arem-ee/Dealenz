import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ExtractedData } from "@/lib/ai/extract"

// ── Degradation-flag coverage: AI fallbacks must be user-visible, never
// silent. riskDegraded marks a heuristic freelance rating; rulesDegraded
// marks incomplete safety checks. Both are server-written only.

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
const mockReportAIFallback = vi.hoisted(() => vi.fn())

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
  reportAIFallback: mockReportAIFallback,
}))

vi.mock("@/lib/rules", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rules")>("@/lib/rules")
  return { ...actual, evaluateApplicableRules: mockEvaluateRules }
})

const mockEvaluateRules = vi.hoisted(() => vi.fn())

vi.mock("./actions", async () => ({ ...(await vi.importActual<typeof import("./actions")>("./actions")) }))

import { analyzeDeal, updateAudit } from "./actions"

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

// auditsQuery that also records every update payload it receives.
function captureAudits(auditRow: unknown, lockRows: unknown[]) {
  const seen: unknown[] = []
  const builder = qb()
  let updated = false
  builder.single = vi.fn().mockResolvedValue({ data: auditRow, error: null })
  const innerUpdate = vi.fn((arg: unknown) => {
    seen.push(arg)
    updated = true
    return builder
  })
  builder.update = innerUpdate as unknown as typeof builder.update
  builder.or = vi.fn(() => builder)
  const terminalSelect = vi.fn(() => {
    if (updated) return Promise.resolve({ data: lockRows, error: null })
    return builder
  })
  builder.select = terminalSelect as unknown as typeof builder.select
  return { builder, seen }
}

const mockUser = { id: "00000000-0000-0000-0000-000000000001", email: "test@test.com", email_confirmed_at: "2024-01-01" }

function consentQb() {
  const b = qb({ data: { has_consented_to_ai_analysis: true }, error: null })
  b.maybeSingle = vi.fn().mockResolvedValue({ data: { has_consented_to_ai_analysis: true }, error: null })
  return b
}

const freelanceExtracted: ExtractedData = {
  goals: ["Redesign site"],
  deliverables: ["Homepage"],
  timeline: null,
  budget: null,
  projectType: "freelance",
  clientSignals: [],
  missingInformation: [],
  confidence: 0.8,
}

function heuristicBackedReport(usedFallback: boolean) {
  return {
    report: {
      overallScore: 50,
      riskLevel: "Medium",
      categories: {},
      summary: "Heuristic rating.",
      recommendations: [],
    },
    usedFallback,
  }
}

describe("degradation flags (fallback visibility)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ allowed: true })
    mockNegotiationPointsFn.mockResolvedValue(["Ask about the cap"])
  })

  it("marks riskDegraded when freelance AI falls back to the heuristic engine", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const { builder: audits, seen } = captureAudits(
      {
        id: "audit-freelance-degraded",
        ai_consent: true,
        raw_input: "Website redesign for a client, fee to be agreed.",
        structured_data: { files: [] },
        deal_type: "freelance",
        context_envelope: null,
      },
      [{ id: "audit-freelance-degraded" }]
    )
    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQb() : table === "audits" ? audits : qb()))
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: freelanceExtracted })
    mockAnalyzeRiskFn.mockResolvedValue(heuristicBackedReport(true))

    // Real rule evaluation: import from the defining module, not the
    // mocked barrel (the barrel re-export resolves to the mock itself).
    const { evaluateApplicableRules: realEval } = await import("@/lib/rules/registry")
    mockEvaluateRules.mockImplementation(realEval as never)

    const result = await analyzeDeal("audit-freelance-degraded")

    expect(result.success).toBe(true)
    expect(result.riskDegraded).toBe(true)
    expect(result.rulesDegraded).toBe(false)
    expect(mockReportAIFallback).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ servedByFallback: true }))
    const persisted = seen
      .map((a) => (a as { structured_data?: Record<string, unknown> }).structured_data)
      .find((sd) => sd && "riskDegraded" in sd)
    expect(persisted?.riskDegraded).toBe(true)
    expect(persisted?.rulesDegraded).toBe(false)
  })

  it("marks rulesDegraded instead of reporting an empty all-clear when rules fail", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const { builder: audits, seen } = captureAudits(
      {
        id: "audit-freelance-rulesdown",
        ai_consent: true,
        raw_input: "Website redesign for a client, fee to be agreed.",
        structured_data: { files: [] },
        deal_type: "freelance",
        context_envelope: null,
      },
      [{ id: "audit-freelance-rulesdown" }]
    )
    mockFrom.mockImplementation((table: string) => (table === "user_ai_consents" ? consentQb() : table === "audits" ? audits : qb()))
    mockStorageFrom.mockReturnValue({ download: vi.fn() })
    mockExtractAndValidate.mockResolvedValue({ valid: true, extractedData: freelanceExtracted })
    mockAnalyzeRiskFn.mockResolvedValue(heuristicBackedReport(false))
    mockEvaluateRules.mockImplementation(() => {
      throw new Error("rules boom")
    })

    const result = await analyzeDeal("audit-freelance-rulesdown")

    expect(result.success).toBe(true)
    expect(result.rulesDegraded).toBe(true)
    expect(result.deterministicFindings).toEqual([])
    const persisted = seen
      .map((a) => (a as { structured_data?: Record<string, unknown> }).structured_data)
      .find((sd) => sd && "rulesDegraded" in sd)
    expect(persisted?.rulesDegraded).toBe(true)
  })

  it("strips degradation flags from client structured_data writes", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    const seen: unknown[] = []
    const builder = qb()
    builder.single = vi.fn().mockResolvedValue({ data: { status: "draft", title: "t" }, error: null })
    builder.update = vi.fn((arg: unknown) => {
      seen.push(arg)
      return builder
    }) as unknown as typeof builder.update
    mockFrom.mockReturnValue(builder)

    await updateAudit("00000000-0000-0000-0000-000000000002", {
      structured_data: {
        custom: "keep",
        riskDegraded: true,
        rulesDegraded: true,
        genericRiskDegraded: true,
        deterministicFindings: [{ ruleKey: "x" }],
      },
    })

    expect(seen).toHaveLength(1)
    expect((seen[0] as { structured_data: Record<string, unknown> }).structured_data).toEqual({ custom: "keep" })
  })
})
