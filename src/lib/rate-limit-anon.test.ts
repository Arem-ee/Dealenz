import { describe, it, expect, vi } from "vitest"
import { getTrustedClientIp, checkAnonymousRateLimit } from "./rate-limit-anon"

function headers(init: Record<string, string>): Headers {
  return new Headers(init)
}

describe("getTrustedClientIp", () => {
  it("prefers x-real-ip (platform-set, not client-controlled)", () => {
    const h = headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.9" })
    expect(getTrustedClientIp(h)).toBe("203.0.113.7")
  })

  it("takes the LAST x-forwarded-for entry (platform-appended), not the first", () => {
    // Attacker prepends a fake IP; the edge appends the real connecting IP.
    const h = headers({ "x-forwarded-for": "1.1.1.1, 198.51.100.9, 203.0.113.7" })
    expect(getTrustedClientIp(h)).toBe("203.0.113.7")
  })

  it("ignores x-anonymous-fp entirely (self-asserted)", () => {
    const h = headers({ "x-forwarded-for": "203.0.113.7", "x-anonymous-fp": "attacker-rotated" })
    expect(getTrustedClientIp(h)).toBe("203.0.113.7")
  })

  it("strips IPv4 ports and rejects garbage", () => {
    expect(getTrustedClientIp(headers({ "x-real-ip": "203.0.113.7:5678" }))).toBe("203.0.113.7")
    expect(getTrustedClientIp(headers({ "x-real-ip": "not an ip!!" }))).toBe("unknown")
    expect(getTrustedClientIp(headers({})) ).toBe("unknown")
  })

  it("accepts IPv6", () => {
    expect(getTrustedClientIp(headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1")
  })
})

describe("checkAnonymousRateLimit", () => {
  it("allows under the limit and denies over it", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ allowed: true, current_count: 1 }], error: null })
      .mockResolvedValueOnce({ data: [{ allowed: false, current_count: 4 }], error: null })
    expect(await checkAnonymousRateLimit({ rpc } as never, "anon:1.2.3.4", 3)).toEqual({ allowed: true, currentCount: 1 })
    expect(await checkAnonymousRateLimit({ rpc } as never, "anon:1.2.3.4", 3)).toEqual({ allowed: false, currentCount: 4 })
    expect(rpc).toHaveBeenCalledWith("check_anonymous_rate_limit", {
      p_key: "anon:1.2.3.4",
      p_limit: 3,
      p_window_seconds: 3600,
    })
  })

  it("fails closed on RPC error, throw, or malformed rows", async () => {
    const errClient = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "down" } }) }
    expect(await checkAnonymousRateLimit(errClient as never, "k", 3)).toEqual({ allowed: false, currentCount: 0 })
    const throwClient = { rpc: vi.fn().mockRejectedValue(new Error("boom")) }
    expect(await checkAnonymousRateLimit(throwClient as never, "k", 3)).toEqual({ allowed: false, currentCount: 0 })
    const weirdClient = { rpc: vi.fn().mockResolvedValue({ data: [{ nope: 1 }], error: null }) }
    expect(await checkAnonymousRateLimit(weirdClient as never, "k", 3)).toEqual({ allowed: false, currentCount: 0 })
  })
})
