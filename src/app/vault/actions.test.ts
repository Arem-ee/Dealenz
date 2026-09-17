import { describe, it, expect, vi, beforeEach } from "vitest"
import { vaultChatAction } from "./actions"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

function auditsMock(rows: unknown[]) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => Promise.resolve({ data: rows, error: null }))
  return builder
}

beforeEach(() => {
  mockGetUser.mockReset()
  mockFrom.mockReset()
})

describe("vaultChatAction error contract (no throws across the boundary)", () => {
  it("returns signed-out as data, never throws", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const res = await vaultChatAction({ text: "show me recent deals" })
    expect(res.ok).toBe(false)
    if (res.ok) throw new Error("unreachable")
    expect(res.error).toMatch(/signed in/)
  })

  it("returns empty input as data, never throws", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    const res = await vaultChatAction({ text: "   " })
    expect(res.ok).toBe(false)
    if (res.ok) throw new Error("unreachable")
    expect(typeof res.error).toBe("string")
  })

  it("answers from the vault on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    mockFrom.mockImplementation(() => auditsMock([]))
    const res = await vaultChatAction({ text: "hello there" })
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error("unreachable")
    expect(res.content).toMatch(/recent deals/)
  })
})
