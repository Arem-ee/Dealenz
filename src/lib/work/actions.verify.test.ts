import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  approveWorkPlan,
  createDealAnalysisPlan,
  createWorkPlan,
  executeApprovedPlan,
  rejectWorkPlan,
  requestApproval,
  resumeWorkPlan,
} from "./actions"

// P0-3: work-plan mutations and execution are AI/cost-bearing, so they
// require a verified email. Pure reads stay available pre-verification.
const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const verifiedUser = { id: "00000000-0000-0000-0000-000000000001", email: "t@t.co", email_confirmed_at: "2024-01-01" }
const unverifiedUser = { ...verifiedUser, email_confirmed_at: null }

beforeEach(() => {
  mockGetUser.mockReset()
  mockFrom.mockReset()
  mockFrom.mockImplementation(() => {
    throw new Error("DB must not be touched before verification")
  })
})

async function denyCases(): Promise<Array<{ name: string; result: { ok: boolean; error?: string } }>> {
  return [
    { name: "createWorkPlan", result: await createWorkPlan({ objective: "x", steps: [] }) },
    { name: "requestApproval", result: await requestApproval("plan-1") },
    { name: "approveWorkPlan", result: await approveWorkPlan("plan-1", "key-1") },
    { name: "rejectWorkPlan", result: await rejectWorkPlan("plan-1") },
    { name: "executeApprovedPlan", result: await executeApprovedPlan("plan-1", "approval-1") },
    { name: "createDealAnalysisPlan", result: await createDealAnalysisPlan({ conversationId: "c", dealId: "d" }) },
    { name: "resumeWorkPlan", result: await resumeWorkPlan("plan-1") },
  ]
}

describe("work actions email verification (P0-3)", () => {
  it("denies every plan mutation and execution for unverified users without touching the DB", async () => {
    mockGetUser.mockResolvedValue({ data: { user: unverifiedUser }, error: null })
    for (const { name, result } of await denyCases()) {
      expect(result.ok, name).toBe(false)
      if (!result.ok) expect(result.error, name).toMatch(/verify your email/)
    }
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("lets verified users past the gate (DB reached)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: verifiedUser }, error: null })
    const result = await createWorkPlan({
      objective: "Analyze deal",
      steps: [{ operation: "document_analysis", estimatedCredits: 5 }],
    })
    // createPlan runs against the mock and fails there — what matters is the
    // verification gate did not reject first.
    expect(mockFrom).toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).not.toMatch(/verify your email/)
  })
})
