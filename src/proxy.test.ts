import { describe, it, expect, vi, beforeEach } from "vitest"

const mockAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: mockAuth })),
}))

vi.mock("@/lib/logger", () => ({
  logEvent: vi.fn(),
  logEventWithClient: vi.fn(),
  logDuration: vi.fn(() => 100),
}))

import type { NextRequest } from "next/server"
import { proxy } from "./proxy"
import { logEventWithClient } from "@/lib/logger"

function mockRequest(url: string) {
  const u = new URL(url)
  return {
    nextUrl: { href: u.href, pathname: u.pathname, origin: u.origin, clone: () => new URL(u.href) },
    cookies: { getAll: () => [], set: vi.fn(), get: vi.fn() },
  } as unknown as NextRequest
}

describe("proxy middleware — auth redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirects authenticated user on /login to /dashboard", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null })
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } }, error: null })

    const res = await proxy(mockRequest("http://localhost:3000/login"))

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard")
  })

  it("redirects unauthenticated user on /dashboard to /login", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await proxy(mockRequest("http://localhost:3000/dashboard"))

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3000/login")
  })

  it("allows unauthenticated access to /login", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const res = await proxy(mockRequest("http://localhost:3000/login"))

    expect(res.status).toBe(200)
  })

  it("logs auth failure when getUser throws", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null })
    mockAuth.getUser.mockRejectedValue(new Error("Token expired"))

    await proxy(mockRequest("http://localhost:3000/login"))

    expect(logEventWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        phase: "auth_get_user",
        status: "failure",
        error_message: "Token expired",
      })
    )
  })

  it("logs redirect for authenticated user", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null })
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } }, error: null })

    await proxy(mockRequest("http://localhost:3000/login"))

    expect(logEventWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        phase: "auth_redirect",
        status: "success",
        error_message: "Authenticated user redirected to /dashboard",
      })
    )
  })
})
