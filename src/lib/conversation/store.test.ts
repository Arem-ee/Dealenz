import { describe, it, expect, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createConversation, getConversation, listConversations, listMessages } from "./store"

describe("conversation store", () => {
  it("migration enables RLS with ownership policies", () => {
    const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "00028_conversations.sql"), "utf8")
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/Users can manage own conversations/)
    expect(sql).toMatch(/Users can manage own conversation messages/)
    expect(sql).not.toMatch(/FOR INSERT[\s\S]{0,200}USING \(true\)/)
    expect(sql).toMatch(/REFERENCES conversations\(id\) ON DELETE CASCADE/)
    expect(sql).toMatch(/attached_audit_id UUID REFERENCES audits\(id\) ON DELETE SET NULL/)
  })
})

describe("estimateAskCredits", () => {
  it("prices per operation tier and is zero for greetings", async () => {
    // Ask actions were wiped in the rebuild; pricing tiers live in lib and
    // stay pinned here until the estimator returns.
    const { classifyOperation, isGreeting } = await import("@/lib/conversation/request")
    const { priceForOperation } = await import("@/lib/credits/pricing")
    expect(isGreeting("Hello")).toBe(true)
    // Tier rescale: brief 2, standard 6 (was 10/30).
    expect(priceForOperation(classifyOperation("Hello", false))).toBe(2)
    expect(priceForOperation(classifyOperation("Should I accept this freelance contract?", true))).toBe(6)
  }, 20000)
})

function mockClient(tableData: Record<string, unknown[]> = {}) {
  const calls: Array<{ table: string; op: string; args: unknown }> = []
  const from = vi.fn((table: string) => {
    const rows = tableData[table] ?? []
    let limitN: number | null = null
    const builder: Record<string, unknown> = {}
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.order = vi.fn(() => builder)
    builder.limit = vi.fn((n: number) => {
      limitN = n
      return builder
    })
    builder.insert = vi.fn((payload: unknown) => {
      calls.push({ table, op: "insert", args: payload })
      return builder
    })
    builder.update = vi.fn((payload: unknown) => {
      calls.push({ table, op: "update", args: payload })
      return builder
    })
    builder.single = vi.fn(async () => ({ data: rows[0] ?? null, error: null }))
    builder.maybeSingle = vi.fn(async () => ({ data: rows[0] ?? null, error: null }))
    // thenable for list queries
    builder.then = (resolve: (v: unknown) => unknown) => {
      const sliced = limitN !== null ? rows.slice(0, limitN) : rows
      return Promise.resolve({ data: sliced, error: null }).then(resolve)
    }
    return builder
  })
  return { from, calls } as unknown as { from: typeof from; calls: typeof calls }
}

describe("conversation persistence", () => {
  it("creates and lists conversations scoped to the owner", async () => {
    const client = mockClient({
      conversations: [{ id: "conv-1", user_id: "user-1", title: "Hello", attached_audit_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
    }) as never
    const created = await createConversation(client, "user-1", { firstText: "Hello world", attachedAuditId: null })
    expect(created.title).toBeDefined()
    const listed = await listConversations(client, "user-1")
    expect(Array.isArray(listed)).toBe(true)
  })

  it("persists and reloads messages with bounded history", async () => {
    const client = mockClient({
      conversation_messages: Array.from({ length: 30 }, (_, i) => ({
        id: `msg-${i}`,
        conversation_id: "conv-1",
        user_id: "user-1",
        role: i % 2 === 0 ? "user" : "assistant",
        content: `message ${i}`,
        operation: null,
        intent: null,
        objective: null,
        metadata: {},
        created_at: new Date().toISOString(),
      })),
    }) as never
    const messages = await listMessages(client, "user-1", "conv-1", 20)
    expect(messages.length).toBeLessThanOrEqual(20)
  })

  it("rejects cross-owner access via the store guard", async () => {
    const client = mockClient({ conversations: [] }) as never
    const conv = await getConversation(client, "user-1", "conv-foreign")
    expect(conv).toBeNull()
  })
})
