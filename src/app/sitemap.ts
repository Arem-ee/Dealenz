import type { MetadataRoute } from "next"

// Public marketing/auth surface only. Authenticated, deal, review, signing,
// and API routes are never listed (robots.ts already disallows /api/ and
// /audit/; token-gated pages must not be crawled).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://dealenz.ai").replace(/\/$/, "")
  const pages = ["/", "/login", "/register", "/terms", "/privacy", "/lawyer-application", "/lawyer-application/status"]
  return pages.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }))
}
