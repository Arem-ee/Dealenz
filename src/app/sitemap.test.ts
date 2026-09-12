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
      expect(url).not.toContain("/lawyer")
      expect(url).not.toContain("/dashboard")
    }
    expect(urls.some((u) => u.endsWith("/login"))).toBe(true)
  })
})
