import type { MetadataRoute } from "next"

// Public marketing/auth/support surface only. Authenticated, deal, review,
// signing, lawyer-workspace, and API routes are never listed (robots.ts
// disallows them; token-gated pages must not be crawled).
function siteBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dealenz.site").replace(/\/$/, "")
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteBase()
  const pages = ["/", "/login", "/register", "/terms", "/privacy", "/help"]
  return pages.map((path) => ({
    url: `${base}${path}`,
  }))
}
