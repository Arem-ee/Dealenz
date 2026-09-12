import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const buckets = vi.hoisted(() => new Map<string, number>())
const mockExtract = vi.hoisted(() => vi.fn())
const mockRisk = vi.hoisted(() => vi.fn())

const mockInsert = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({ insert: mockInsert })),
    rpc: vi.fn((fn: string, args: { p_key: string; p_limit: number }) => {
      if (fn !== "check_anonymous_rate_limit") {
        return Promise.resolve({ data: null, error: { message: "unknown fn" } })
      }
      const count = (buckets.get(args.p_key) ?? 0) + 1
      buckets.set(args.p_key, count)
      return Promise.resolve({
        data: [{ allowed: count <= args.p_limit, current_count: count }],
        error: null,
      })
    }),
  })),
}))

vi.mock("@/lib/ai/extract", () => ({
  extractAndValidate: (...args: unknown[]) => mockExtract(...args),
}))

vi.mock("@/lib/ai/risk-analysis", () => ({
  analyzeRiskForDealType: (...args: unknown[]) => mockRisk(...args),
}))

import { POST, GET } from "./route"

function jsonReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/analyze-anonymous", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

const ANALYSIS = { valid: true, extractedData: { confidence: 0.9 } }
const RISK = { report: { level: "low" }, usedFallback: false }

beforeEach(() => {
  vi.clearAllMocks()
  buckets.clear()
  mockExtract.mockResolvedValue(ANALYSIS)
  mockRisk.mockResolvedValue(RISK)
})

describe("POST /api/analyze-anonymous hardening", () => {
  it("serves a valid request and reports truncation explicitly", async () => {
    const res = await POST(jsonReq({ prompt: "Review this freelance deal", dealType: "generic" }, { "x-real-ip": "203.0.113.5" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.truncated).toBe(false)
    expect(typeof body.originalLength).toBe("number")
    expect(mockExtract).toHaveBeenCalledTimes(1)
  })

  it("limits repeated requests from the same IP", async () => {
    const headers = { "x-real-ip": "203.0.113.6" }
    for (let i = 0; i < 3; i++) {
      const res = await POST(jsonReq({ prompt: "deal please", dealType: "generic" }, headers))
      expect(res.status).toBe(200)
    }
    const limited = await POST(jsonReq({ prompt: "deal please", dealType: "generic" }, headers))
    expect(limited.status).toBe(429)
    expect(mockExtract).toHaveBeenCalledTimes(3)
  })

  it("rotating spoofed headers cannot bypass the limit", async () => {
    const base = { "x-real-ip": "203.0.113.7" }
    for (let i = 0; i < 3; i++) {
      await POST(
        jsonReq({ prompt: "deal please", dealType: "generic" }, { ...base, "x-anonymous-fp": `fp-${i}`, "x-forwarded-for": `9.9.9.${i}` })
      )
    }
    // New fingerprint + forged XFF, same platform IP: still limited.
    const res = await POST(
      jsonReq({ prompt: "deal please", dealType: "generic" }, { ...base, "x-anonymous-fp": "fp-fresh", "x-forwarded-for": "8.8.8.8" })
    )
    expect(res.status).toBe(429)
    expect(mockExtract).toHaveBeenCalledTimes(3)
  })

  it("rejects oversized bodies and invalid input before consuming quota or AI", async () => {
    const big = await POST(jsonReq({ prompt: "x".repeat(600_000) }, { "x-real-ip": "203.0.113.8" }))
    expect(big.status).toBe(413)
    const empty = await POST(jsonReq({ prompt: "  " }, { "x-real-ip": "203.0.113.8" }))
    expect(empty.status).toBe(400)
    expect(mockExtract).not.toHaveBeenCalled()
    // Nothing consumed: a later valid request still succeeds.
    const ok = await POST(jsonReq({ prompt: "real deal text here", dealType: "generic" }, { "x-real-ip": "203.0.113.8" }))
    expect(ok.status).toBe(200)
  })

  it("rejects non-POST", async () => {
    const res = await GET()
    expect(res.status).toBe(405)
  })

  it("records fallback use durably without changing the user payload", async () => {
    mockRisk.mockResolvedValue({ report: { level: "low" }, usedFallback: true })
    const res = await POST(jsonReq({ prompt: "Review this freelance deal", dealType: "generic" }, { "x-real-ip": "203.0.113.21" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.usedFallback).toBe(true)
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const calls = mockInsert.mock.calls as unknown as Array<[unknown]>
    const row = calls[0]![0] as {
      phase?: unknown
      severity?: unknown
      metadata?: Record<string, unknown>
    }
    expect(row.phase).toBe("ai_fallback")
    expect(row.severity).toBe("warn")
    expect(row.metadata?.surface).toBe("quick_review")
    // No deal content in the record.
    expect(JSON.stringify(row)).not.toContain("freelance deal")
  })
})
