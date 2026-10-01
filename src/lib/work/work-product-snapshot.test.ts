import { describe, it, expect, vi } from "vitest"

import { executePlan } from "./executor"

// The document_analysis step delegated to the wiped analyzeDeal pipeline.
// Until the pipeline returns with the rebuild, the step must fail honestly
// (rebuild error, zero credits) — never silently succeed, never charge.
describe("WorkProduct snapshot", () => {
  it("surfaces the rebuild error on analysis steps without charging", async () => {
    const userId = "00000000-0000-0000-0000-000000000001"
    const planId = "00000000-0000-0000-0000-000000000001"
    const auditId = "00000000-0000-0000-0000-0000000000aa"
    const threadId = "00000000-0000-0000-0000-0000000000bb"

    const planRow = { id: planId, user_id: userId, conversation_id: threadId, deal_id: auditId, objective: "Analyze deal: Test", objective_kind: "deal_analysis", version: 1, estimated_credits: 0, status: "approved", payload_hash: "ph_test", approved_at: new Date().toISOString(), completed_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    const step = { id: "00000000-0000-0000-0000-000000000011", plan_id: planId, user_id: userId, step_index: 0, operation: "document_analysis", input_ref: { auditId, threadId }, depends_on: [], estimated_credits: 0, status: "pending", result_ref: null, credits_consumed: null, error: null }
    let stepError: string | null = null
    let stepCredits: number | null = null

    const client: Record<string, unknown> = {}
    client.from = vi.fn((table: string) => {
      const self: Record<string, unknown> = {}
      if (table === "work_plans") {
        self.select = vi.fn(() => self)
        self.eq = vi.fn(() => self)
        self.maybeSingle = vi.fn(() => Promise.resolve({ data: planRow, error: null }))
        const chain: Record<string, unknown> = {}
        chain.eq = vi.fn(() => chain)
        chain.select = vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: planRow, error: null })) }))
        self.update = vi.fn(() => chain as never)
        return self as never
      }
      if (table === "work_plan_steps") {
        self.select = vi.fn(() => self)
        self.eq = vi.fn(() => self)
        self.order = vi.fn(() => Promise.resolve({ data: [{ ...step }], error: null }) as never)
        self.update = vi.fn((upd: Record<string, unknown>) => {
          if (typeof upd.error === "string") stepError = upd.error
          if (typeof upd.credits_consumed === "number") stepCredits = upd.credits_consumed
          return { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) } as never
        })
        return self as never
      }
      if (table === "work_executions") {
        self.select = vi.fn(() => self)
        self.eq = vi.fn(() => self)
        self.in = vi.fn(() => self)
        self.order = vi.fn(() => self)
        self.limit = vi.fn(() => self)
        self.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
        self.single = vi.fn(() => Promise.resolve({ data: { id: "exec-1", status: "pending" }, error: null }))
        const singlePending = () => Promise.resolve({ data: { id: "exec-1", status: "pending" }, error: null })
        self.insert = vi.fn(() => ({ select: () => ({ single: singlePending }) }) as never)
        const chain: Record<string, unknown> = {}
        chain.eq = vi.fn(() => chain)
        const singleFailed = () => Promise.resolve({ data: { id: "exec-1", status: "failed" }, error: null })
        chain.select = vi.fn(() => ({ single: singleFailed }))
        self.update = vi.fn(() => chain as never)
        return self as never
      }
      self.select = vi.fn(() => self)
      self.eq = vi.fn(() => self)
      self.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
      self.insert = vi.fn(() => Promise.resolve({ data: null, error: null }))
      self.update = vi.fn(() => self)
      self.order = vi.fn(() => self)
      self.limit = vi.fn(() => self)
      return self as never
    })
    client.rpc = vi.fn(() => Promise.resolve({ data: [{ allowed: true, balance: 100, reservation_id: null }], error: null }))

    const approval = { plan_version: 1, approved_payload_hash: "ph_test", id: "00000000-0000-0000-0000-000000000030" }
    const res = await executePlan({ client: client as never, userId, planId, approval: approval as never, policy: null })
    expect(res.status).toBe("failed")
    expect(stepError).toMatch(/rebuild/)
    expect(stepCredits).toBe(0)
  })
})
