import { describe, it, expect } from "vitest"
import sitemap from "./sitemap"

describe("sitemap", () => {
  it("lists only public routes, never authenticated or token-gated paths", () => {
    const entries = sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(url).not.toContain("/audit")
      expect(url).not.toContain("/api/")
      expect(url).not.toContain("/sign/")
      expect(url).not.toContain("/lawyer/")
      expect(url).not.toContain("/lawyer?")
      expect(url).not.toContain("/dashboard")
    }
    expect(urls.some((u) => u.endsWith("/login"))).toBe(true)
    expect(urls.some((u) => u.endsWith("/lawyer-application"))).toBe(true)
    expect(urls.some((u) => u.endsWith("/help"))).toBe(true)
    // Auth-gated status page must never be advertised to crawlers.
    expect(urls.some((u) => u.includes("/lawyer-application/status"))).toBe(false)
  })

  it("uses one canonical base for every entry", () => {
    const entries = sitemap()
    const bases = new Set(entries.map((e) => new URL(e.url).origin))
    expect(bases.size).toBe(1)
  })
})
