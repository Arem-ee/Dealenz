import { describe, it, expect, vi, beforeEach } from "vitest"

const mockInsert = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({ insert: mockInsert })),
    rpc: mockRpc,
  })),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers({ "x-real-ip": "203.0.113.9" }))),
}))

import { logAuthFailure } from "./actions"

function rpcAllow() {
  mockRpc.mockResolvedValue({ data: [{ allowed: true, current_count: 1 }], error: null })
  mockInsert.mockResolvedValue({ error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("logAuthFailure (original behavior preserved through hardened path)", () => {
  it("logs login failure with error message", async () => {
    rpcAllow()
    await logAuthFailure("Invalid credentials", "login")
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const row = mockInsert.mock.calls[0][0]
    expect(row).toMatchObject({
      phase: "auth_login",
      status: "failure",
      error_message: "Invalid credentials",
    })
  })

  it("logs register failure with error message", async () => {
    rpcAllow()
    await logAuthFailure("Email already in use", "register")
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const row = mockInsert.mock.calls[0][0]
    expect(row).toMatchObject({
      phase: "auth_register",
      status: "failure",
      error_message: "Email already in use",
    })
  })
})

describe("logAuthFailure hardening", () => {
  it("logs bounded messages for valid modes", async () => {
    rpcAllow()
    await logAuthFailure("Invalid login credentials", "login")
    expect(mockRpc).toHaveBeenCalledWith("check_anonymous_rate_limit", {
      p_key: "authlog:203.0.113.9",
      p_limit: 20,
      p_window_seconds: 3600,
    })
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const row = mockInsert.mock.calls[0][0]
    expect(row.phase).toBe("auth_login")
    expect(row.error_message).toBe("Invalid login credentials")
  })

  it("truncates oversized messages", async () => {
    rpcAllow()
    await logAuthFailure("x".repeat(5000), "register")
    const row = mockInsert.mock.calls[0][0]
    expect(row.phase).toBe("auth_register")
    expect(row.error_message.length).toBe(500)
  })

  it("drops invalid modes and empty messages without writing", async () => {
    rpcAllow()
    await logAuthFailure("boom", "delete-all" as never)
    await logAuthFailure("", "login")
    await logAuthFailure("   ", "login")
    await logAuthFailure(null as never, "login")
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("drops writes when the per-IP quota is exhausted", async () => {
    mockRpc.mockResolvedValue({ data: [{ allowed: false, current_count: 21 }], error: null })
    await logAuthFailure("Invalid login credentials", "login")
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
