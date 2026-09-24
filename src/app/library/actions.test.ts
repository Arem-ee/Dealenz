import { describe, it, expect, vi, beforeEach } from "vitest"
import { listStandingRules, addStandingRule, deleteStandingRule, getStandingRuleTexts } from "./actions"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const mockUser = { id: "user-1", email: "test@test.com" }

function chain(final: unknown) {
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve(final))
  builder.then = undefined
  return builder
}

function terminal(value: unknown) {
  const builder = chain(value)
  // Awaiting the builder resolves the terminal value (supabase-js thenable).
  const p = Promise.resolve(value)
  return Object.assign(builder, { then: p.then.bind(p) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
})

describe("listStandingRules", () => {
  it("returns the caller's rules oldest first", async () => {
    mockFrom.mockReturnValue(terminal({ data: [{ id: "r1", text: "Rule one", created_at: "2026-01-01" }], error: null }))
    const result = await listStandingRules()
    expect(result).toEqual({ ok: true, rules: [{ id: "r1", text: "Rule one", created_at: "2026-01-01" }] })
    const builder = mockFrom.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>
    expect(builder.eq).toHaveBeenCalledWith("user_id", mockUser.id)
  })

  it("rejects unauthenticated callers and masks database errors", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await listStandingRules()).toEqual({ ok: false, error: "You must be signed in." })
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockFrom.mockReturnValue(terminal({ data: null, error: { message: "relation \"standing_instructions\" does not exist" } }))
    const result = await listStandingRules()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).not.toMatch(/standing_instructions/)
  })
})

describe("addStandingRule", () => {
  it("saves a trimmed rule", async () => {
    mockFrom
      .mockReturnValueOnce(terminal({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: { id: "r1", text: "Rule one", created_at: "2026-01-02" }, error: null }))
    const result = await addStandingRule("  Rule one  ")
    expect(result).toEqual({ ok: true, rule: { id: "r1", text: "Rule one", created_at: "2026-01-02" } })
    const insertBuilder = mockFrom.mock.results[1].value as Record<string, ReturnType<typeof vi.fn>>
    expect(insertBuilder.insert).toHaveBeenCalledWith({ user_id: mockUser.id, text: "Rule one" })
  })

  it("refuses empty text and a full rulebook", async () => {
    expect(await addStandingRule("   ")).toEqual({ ok: false, error: "Write the rule first." })
    mockFrom.mockReturnValue(terminal({ data: Array.from({ length: 20 }, (_, i) => ({ id: `r${i}` })), error: null }))
    const full = await addStandingRule("One more")
    expect(full.ok).toBe(false)
    if (!full.ok) expect(full.error).toMatch(/20 rules/)
  })
})

describe("deleteStandingRule", () => {
  it("scopes the delete to the caller's row", async () => {
    mockFrom.mockReturnValue(terminal({ data: null, error: null }))
    expect(await deleteStandingRule("r1")).toEqual({ ok: true })
    const builder = mockFrom.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>
    expect(builder.eq).toHaveBeenCalledWith("id", "r1")
    expect(builder.eq).toHaveBeenCalledWith("user_id", mockUser.id)
  })

  it("rejects blank ids", async () => {
    expect(await deleteStandingRule("  ")).toEqual({ ok: false, error: "That rule no longer exists." })
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe("getStandingRuleTexts", () => {
  it("returns texts oldest first and never throws", async () => {
    mockFrom.mockReturnValue(terminal({ data: [{ text: "A" }, { text: "B" }], error: null }))
    await expect(getStandingRuleTexts()).resolves.toEqual(["A", "B"])
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(getStandingRuleTexts()).resolves.toEqual([])
  })
})
