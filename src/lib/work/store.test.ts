import { describe, it, expect, vi } from "vitest"

vi.mock("./hash", async () => {
  const actual = await vi.importActual("./hash") as never
  return { ...(actual as object), planPayloadHash: () => "ph_testhash" }
})

import { createPlan, requestPlanApproval, approvePlan } from "./store"

function makeMock() {
  const planId = "00000000-0000-0000-0000-000000000001"
  const userId = "00000000-0000-0000-0000-000000000001"
  const approvalId = "00000000-0000-0000-0000-000000000010"

  function builderFor(table: string) {
    const self: Record<string, unknown> = {}
    // track state for plan status transitions
    let planStatus: string = "draft"
    // Store for work_plans
    if (table === "work_plans") {
      self.insert = vi.fn((row: Record<string, unknown>) => {
        const inserted = { id: planId, user_id: userId, objective: "Analyze", objective_kind: "deal_analysis", version: 1, estimated_credits: 3, status: "draft", payload_hash: "ph_testhash", approved_at: null, completed_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row }
        return {
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: inserted, error: null })),
          })),
        } as never
      })
      self.select = vi.fn(() => self)
      self.eq = vi.fn(() => self)
      self.maybeSingle = vi.fn(() => Promise.resolve({ data: { id: planId, user_id: userId, version: 1, payload_hash: "ph_testhash", status: planStatus }, error: null }))
      self.single = vi.fn(() => Promise.resolve({ data: { id: planId, user_id: userId, version: 1, payload_hash: "ph_testhash", status: "awaiting_approval", approved_at: new Date().toISOString() }, error: null }))
      self.update = vi.fn((upd: Record<string, unknown>) => {
        planStatus = (upd.status as string) ?? planStatus
        const chain: Record<string, unknown> = {}
        chain.eq = vi.fn(() => chain)
        chain.select = vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: planId, user_id: userId, version: 1, payload_hash: "ph_testhash", status: planStatus, approved_at: planStatus === "approved" ? new Date().toISOString() : null }, error: null })),
        }))
        return chain as never
      })
      self.delete = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })) as never
      self.order = vi.fn(() => self)
      return self as never
    }
    if (table === "work_plan_steps") {
      self.insert = vi.fn((rows: unknown) => {
        const arr = Array.isArray(rows) ? rows : [rows]
        const out = arr.map((r, i) => ({ id: `00000000-0000-0000-0000-00000000000${i+2}`, plan_id: planId, user_id: userId, step_index: i, status: "pending", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...(r as object) }))
        return {
          select: vi.fn(() => Promise.resolve({ data: out, error: null })),
        } as never
      })
      self.select = vi.fn(() => self)
      self.eq = vi.fn(() => self)
      self.order = vi.fn(() => Promise.resolve({ data: [], error: null }) as never)
      self.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
      self.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
      self.update = vi.fn(() => self)
      self.delete = vi.fn(() => self)
      return self as never
    }
    if (table === "work_approvals") {
      self.select = vi.fn(() => self)
      self.eq = vi.fn(() => self)
      self.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
      self.insert = vi.fn((row: Record<string, unknown>) => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: approvalId, plan_id: planId, user_id: userId, plan_version: 1, scope: {}, approved_payload_hash: "ph_testhash", actor_user_id: userId, approved_at: new Date().toISOString(), expires_at: null, idempotency_key: row.idempotency_key }, error: null })),
        })),
      })) as never
      self.update = vi.fn(() => self)
      return self as never
    }
    // default
    self.select = vi.fn(() => self)
    self.eq = vi.fn(() => self)
    self.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
    self.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
    self.insert = vi.fn(() => self)
    self.update = vi.fn(() => self)
    self.delete = vi.fn(() => self)
    self.order = vi.fn(() => self)
    return self as never
  }
  const client = { from: vi.fn(builderFor), rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) } as unknown as { from: (t: string) => never; rpc: ReturnType<typeof vi.fn> }
  return client
}

describe("createPlan", () => {
  it("creates plan and steps with ownership", async () => {
    const client = makeMock()
    const res = await createPlan(client as never, "00000000-0000-0000-0000-000000000001", { objective: "Analyze this deal", steps: [{ operation: "document_analysis", estimatedCredits: 3 }] })
    expect(res.plan.id).toBe("00000000-0000-0000-0000-000000000001")
    expect(res.steps.length).toBe(1)
  })
  it("rejects empty objective", async () => {
    const client = makeMock()
    await expect(createPlan(client as never, "00000000-0000-0000-0000-000000000001", { objective: " ", steps: [{ operation: "x", estimatedCredits: 1 }] })).rejects.toThrow()
  })
})

describe("requestPlanApproval", () => {
  it("moves draft to awaiting_approval", async () => {
    const client = makeMock()
    const res = await requestPlanApproval(client as never, "00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000001")
    expect(res.status).toBe("awaiting_approval")
  })
})

describe("approvePlan idempotency", () => {
  it("creates approval and moves to approved", async () => {
    const client = makeMock()
    // Override from for work_plans to return awaiting_approval on maybeSingle
    const origFrom = client.from.bind(client)
    const patched = {
      ...client,
      from(table: string) {
        const base = origFrom(table) as unknown as Record<string, unknown>
        if (table === "work_plans") {
          ;(base as Record<string, unknown>).maybeSingle = vi.fn(() => Promise.resolve({ data: { id: "00000000-0000-0000-0000-000000000001", user_id: "00000000-0000-0000-0000-000000000001", version: 1, payload_hash: "ph_testhash", status: "awaiting_approval" }, error: null }))
          ;(base as Record<string, unknown>).single = vi.fn(() => Promise.resolve({ data: { id: "00000000-0000-0000-0000-000000000001", user_id: "00000000-0000-0000-0000-000000000001", version: 1, payload_hash: "ph_testhash", status: "approved", approved_at: new Date().toISOString() }, error: null }))
        }
        return base as never
      },
    } as never
    const res = await approvePlan(patched as never, "00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000001", { idempotencyKey: "k1" })
    expect(res.approval.id).toBe("00000000-0000-0000-0000-000000000010")
    expect(res.plan.status).toBe("approved")
  })
})
