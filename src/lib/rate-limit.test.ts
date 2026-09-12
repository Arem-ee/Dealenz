import { describe, it, expect, vi, beforeEach } from "vitest"
import { rateLimitFor } from "./rate-limit"

const mockRpc = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ rpc: mockRpc })),
}))

import { checkRateLimit } from "./rate-limit"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("checkRateLimit", () => {
  it("allows when the RPC row allows (array shape, as PostgREST returns)", async () => {
    mockRpc.mockResolvedValue({ data: [{ allowed: true, current_count: 2 }], error: null })
    await expect(checkRateLimit("analyzeDeal")).resolves.toEqual({ allowed: true })
    expect(mockRpc).toHaveBeenCalledWith("increment_usage", { p_action_type: "analyzeDeal", p_limit: 5 })
  })

  it("denies when the RPC row denies", async () => {
    mockRpc.mockResolvedValue({ data: [{ allowed: false, current_count: 5 }], error: null })
    const res = await checkRateLimit("analyzeDeal")
    expect(res.allowed).toBe(false)
    expect(res.error).toMatch(/usage limit/)
  })

  it("supports the checkout action with its own limit", async () => {
    mockRpc.mockResolvedValue({ data: [{ allowed: true, current_count: 1 }], error: null })
    await expect(checkRateLimit("createCheckout")).resolves.toEqual({ allowed: true })
    expect(mockRpc).toHaveBeenCalledWith("increment_usage", {
      p_action_type: "createCheckout",
      p_limit: 10,
    })
  })

  it("supports the lawyer-application action with its own limit", async () => {
    mockRpc.mockResolvedValue({ data: [{ allowed: true, current_count: 1 }], error: null })
    await expect(checkRateLimit("submitLawyerApplication")).resolves.toEqual({ allowed: true })
    expect(mockRpc).toHaveBeenCalledWith("increment_usage", {
      p_action_type: "submitLawyerApplication",
      p_limit: 3,
    })
  })

  it("exposes the single source for UI-displayed limits", () => {
    expect(rateLimitFor("analyzeDeal")).toBe(5)
    expect(rateLimitFor("generateProtectionPackage")).toBe(10)
  })

  it("fails closed on RPC error or malformed rows", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "down" } })
    await expect(checkRateLimit("analyzeDeal")).resolves.toMatchObject({ allowed: false })
    mockRpc.mockResolvedValue({ data: [], error: null })
    await expect(checkRateLimit("analyzeDeal")).resolves.toMatchObject({ allowed: false })
    mockRpc.mockResolvedValue({ data: [{ allowed: "yes" }], error: null })
    await expect(checkRateLimit("analyzeDeal")).resolves.toMatchObject({ allowed: false })
  })
})
