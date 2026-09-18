import { describe, it, expect, vi } from "vitest"

const mockAnalyzeDeal = vi.fn()
vi.mock("@/app/audit/[id]/actions", () => ({
  analyzeDeal: (...args: unknown[]) => mockAnalyzeDeal(...args),
}))

import { executePlan } from "./executor"

describe("WorkProduct snapshot", () => {
  it("contains structured findings/evidence references on success", async () => {
    mockAnalyzeDeal.mockResolvedValueOnce({
      success: true,
      riskReport: { overallScore: 72, riskLevel: "Medium" },
      deterministicFindings: [
        { ruleKey: "payment-risk", finding: { severity: "material", summary: "Payment risk", guidance: "Ask for staged payments", evidence: [{ id: "ev_abc", quote: "Payment due 14 days", location: { kind: "exact", startOffset: 0, endOffset: 12 } }] }, severity: "material", summary: "Payment risk", guidance: "Ask for staged payments", evidence: [{ id: "ev_abc", quote: "Payment due 14 days", location: { kind: "exact", startOffset: 0, endOffset: 12 } }], status: "FAIL" },
      ],
      data: { goals: [], deliverables: [], timeline: null, budget: "Payment due 14 days after invoice; 30 days after receiving completed work", projectType: null, clientSignals: [], missingInformation: [], confidence: 0.9 },
    } as never)

    const userId = "00000000-0000-0000-0000-000000000001"
    const planId = "00000000-0000-0000-0000-000000000001"
    const auditId = "00000000-0000-0000-0000-0000000000aa"
    const threadId = "00000000-0000-0000-0000-0000000000bb"
    const executionId = "00000000-0000-0000-0000-000000000020"

    const planRow = { id: planId, user_id: userId, conversation_id: threadId, deal_id: auditId, objective: "Analyze deal: Test", objective_kind: "deal_analysis", version: 1, estimated_credits: 0, status: "approved", payload_hash: "ph_test", approved_at: new Date().toISOString(), completed_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }

    const client: Record<string, unknown> = {}
    client.from = vi.fn((table: string) => {
      const self: Record<string, unknown> = {}
      if (table === "work_plans") {
        self.select = vi.fn(() => self)
        self.eq = vi.fn(() => self)
        self.maybeSingle = vi.fn(() => Promise.resolve({ data: planRow, error: null }))
        self.single = vi.fn(() => Promise.resolve({ data: planRow, error: null }))
        const chain: Record<string, unknown> = {}
        chain.eq = vi.fn(() => chain)
        chain.select = vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: planRow, error: null })) }))
        self.update = vi.fn(() => chain as never)
        return self as never
      }
      if (table === "work_plan_steps") {
        const step = { id: "00000000-0000-0000-0000-000000000011", plan_id: planId, user_id: userId, step_index: 0, operation: "document_analysis", input_ref: { auditId, threadId }, depends_on: [], estimated_credits: 0, status: "pending", result_ref: null, credits_consumed: null, error: null }
        self.select = vi.fn(() => self)
        self.eq = vi.fn(() => self)
        self.order = vi.fn(() => Promise.resolve({ data: [step], error: null }) as never)
        self.in = vi.fn(() => Promise.resolve({ data: [], error: null }) as never)
        self.update = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })) })) })) as never
        // For final snapshot fetch
        if (JSON.stringify(self).includes("result_ref")) {
          // not needed
        }
        return self as never
      }
      if (table === "work_executions") {
        self.select = vi.fn(() => self)
        self.eq = vi.fn(() => self)
        self.in = vi.fn(() => self)
        self.order = vi.fn(() => self)
        self.limit = vi.fn(() => self)
        self.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
        self.single = vi.fn(() => Promise.resolve({ data: { id: executionId, status: "pending" }, error: null }))
        self.insert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: executionId, plan_id: planId, user_id: userId, plan_version: 1, status: "pending" }, error: null })) })) })) as never
        const chain: Record<string, unknown> = {}
        chain.eq = vi.fn(() => chain)
        chain.select = vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: executionId, status: "succeeded" }, error: null })) }))
        self.update = vi.fn(() => chain as never)
        return self as never
      }
      if (table === "audits") {
        self.select = vi.fn(() => self)
        self.eq = vi.fn(() => self)
        self.maybeSingle = vi.fn(() => Promise.resolve({ data: { id: auditId, structured_data: { deterministicFindings: [{ ruleKey: "payment-risk", severity: "material", summary: "Payment risk", guidance: "Ask", evidence: [{ id: "ev_abc", quote: "Payment due 14 days", location: { kind: "exact" } }] }], missingVariables: [] } }, error: null }))
        return self as never
      }
      if (table === "work_products") {
        self.select = vi.fn(() => self)
        self.eq = vi.fn(() => self)
        self.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
        self.order = vi.fn(() => self)
        self.limit = vi.fn(() => self)
        self.insert = vi.fn((row: Record<string, unknown>) => {
          // Verify snapshot contains structured findings/evidence
          const snap = row.snapshot as Record<string, unknown>
          expect(snap).toHaveProperty("riskReport")
          expect((snap.riskReport as Record<string, unknown>).overallScore).toBe(72)
          expect(snap).toHaveProperty("findings")
          const findings = snap.findings as Array<Record<string, unknown>>
          expect(findings[0].ruleKey).toBe("payment-risk")
          expect(findings[0].evidenceId).toBe("ev_abc")
          expect(snap).toHaveProperty("evidence")
          return { select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: row, error: null })) })) } as never
        })
        return self as never
      }
      if (table === "conversation_messages") {
        self.insert = vi.fn(() => Promise.resolve({ data: null, error: null }))
        return self as never
      }
      if (table === "activity_events" || table === "system_logs") {
        self.insert = vi.fn(() => Promise.resolve({ data: null, error: null }))
        return self as never
      }
      self.select = vi.fn(() => self)
      self.eq = vi.fn(() => self)
      self.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
      self.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
      self.insert = vi.fn(() => self)
      self.update = vi.fn(() => self)
      self.order = vi.fn(() => self)
      self.limit = vi.fn(() => self)
      return self as never
    })
    client.rpc = vi.fn(() => Promise.resolve({ data: [{ allowed: true, balance: 100, reservation_id: null }], error: null }))

    const approval = { plan_version: 1, approved_payload_hash: "ph_test", id: "00000000-0000-0000-0000-000000000030" }
    // Mock getPlan to return approved plan
    const res = await executePlan({ client: client as never, userId, planId, approval: approval as never, policy: null })
    expect(res.status).toBe("succeeded")
  })
})
