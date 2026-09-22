import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockGetUser = vi.hoisted(() => vi.fn())
const mockCheckRateLimit = vi.hoisted(() => vi.fn())
const mockCreateSession = vi.hoisted(() => vi.fn())

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

vi.mock("@/lib/billing/provider", () => ({
  getProviderAdapter: vi.fn(() => ({ createCheckoutSession: mockCreateSession })),
  isPaddleConfigured: vi.fn(() => true),
}))

import { POST } from "./route"

const USER = { id: "00000000-0000-0000-0000-000000000001", email: "buyer@example.com", email_confirmed_at: "2024-01-01" }

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
  mockGetUser.mockResolvedValue({ data: { user: USER } })
  mockCheckRateLimit.mockResolvedValue({ allowed: true })
  mockCreateSession.mockResolvedValue({ id: "txn_01test12345678901234567890ab", url: "https://checkout.paddle.com/txn_01test?x=1", provider: "paddle" })
})

describe("POST /api/billing/checkout", () => {
  it("creates sessions from catalog pricing, never client values", async () => {
    const res = await POST(req({ packageId: "standard", currency: "GBP", amountMinor: 1, credits: 99999 }))
    expect(res.status).toBe(200)
    expect(mockCreateSession).toHaveBeenCalledTimes(1)
    const sessionCalls = mockCreateSession.mock.calls as unknown as Array<[Record<string, unknown>]>
    const input = sessionCalls[0]![0] as { amountMinor: number; currency: string; package: { id: string; credits: number } }
    expect(input.amountMinor).toBe(1999)
    expect(input.currency).toBe("GBP")
    expect(input.package.id).toBe("standard")
    expect(input.package.credits).toBe(150)
    expect(mockCheckRateLimit).toHaveBeenCalledWith("createCheckout")
  })

  it("rejects unknown packages, currencies, auth, and unverified email", async () => {
    expect((await POST(req({ packageId: "nope", currency: "USD" }))).status).toBe(400)
    expect((await POST(req({ packageId: "starter", currency: "NGN" }))).status).toBe(400)
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect((await POST(req({ packageId: "starter", currency: "USD" }))).status).toBe(401)
    mockGetUser.mockResolvedValue({ data: { user: { ...USER, email_confirmed_at: null } } })
    expect((await POST(req({ packageId: "starter", currency: "USD" }))).status).toBe(403)
  })

  it("throttles checkout creation with 429", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, error: "Too many checkouts" })
    const res = await POST(req({ packageId: "starter", currency: "USD" }))
    expect(res.status).toBe(429)
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it("returns 500 when provider fails to create session", async () => {
    mockCreateSession.mockRejectedValue(new Error("Paddle API down"))
    const res = await POST(req({ packageId: "starter", currency: "USD" }))
    expect(res.status).toBe(500)
  })

  it("fails closed with 503 on Vercel production when Paddle is unconfigured", async () => {
    const { isPaddleConfigured } = await import("@/lib/billing/provider")
    vi.mocked(isPaddleConfigured).mockReturnValueOnce(false)
    process.env.VERCEL_ENV = "production"
    try {
      const res = await POST(req({ packageId: "starter", currency: "USD" }))
      expect(res.status).toBe(503)
      expect(mockCreateSession).not.toHaveBeenCalled()
    } finally {
      delete process.env.VERCEL_ENV
    }
  })
})
