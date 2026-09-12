import { describe, it, expect } from "vitest"
import config from "../next.config"

describe("security headers", () => {
  it("emits a hardened, compatible header set on all routes", async () => {
    const routes = await config.headers!()
    expect(routes.length).toBeGreaterThan(0)
    const headers = new Map(routes[0].headers.map((h) => [h.key, h.value]))

    const csp = headers.get("Content-Security-Policy") ?? ""
    // No eval: nothing client-side evaluates code.
    expect(csp).not.toContain("unsafe-eval")
    // unsafe-inline retained: Next.js hydration requires it.
    expect(csp).toContain("unsafe-inline")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    // AI calls are server-side; browsers only need Supabase + self.
    expect(csp).toContain("connect-src 'self' https://*.supabase.co")

    expect(headers.get("Strict-Transport-Security")).toMatch(/max-age=\d+/)
    expect(headers.get("Permissions-Policy")).toContain("camera=()")
    expect(headers.get("Permissions-Policy")).toContain("microphone=()")
    expect(headers.get("Permissions-Policy")).toContain("geolocation=()")
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups")
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(headers.get("X-Frame-Options")).toBe("DENY")
  })
})
