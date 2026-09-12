import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockInsert = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })))
const mockRpc = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({ insert: mockInsert })),
    rpc: mockRpc,
  })),
}))

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers({ "x-real-ip": "203.0.113.12" }))),
}))

import { POST } from "./route"

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/client-errors", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRpc.mockResolvedValue({ data: [{ allowed: true, current_count: 1 }], error: null })
})

describe("POST /api/client-errors", () => {
  it("accepts a bounded client error and stores it redacted", async () => {
    const res = await POST(req({ message: "TypeError: x is null", stack: "at foo (app.js:1:2)", url: "/dashboard" }))
    expect(res.status).toBe(200)
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const calls = mockInsert.mock.calls as unknown as Array<[unknown]>
    const row = calls[0]![0] as { phase?: unknown; severity?: unknown }
    expect(row.phase).toBe("client_error")
    expect(row.severity).toBe("error")
  })

  it("rejects missing/oversized payloads without writing", async () => {
    expect((await POST(req({}))).status).toBe(400)
    expect((await POST(req({ message: "x".repeat(501) }))).status).toBe(400)
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockRpc).toHaveBeenCalledTimes(2)
  })

  it("throttles per IP with 429", async () => {
    mockRpc.mockResolvedValue({ data: [{ allowed: false, current_count: 21 }], error: null })
    const res = await POST(req({ message: "boom" }))
    expect(res.status).toBe(429)
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
