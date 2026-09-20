import type { MetadataRoute } from "next"

// Public marketing/auth/support surface only. Authenticated, deal, review,
// signing, lawyer-workspace, and API routes are never listed (robots.ts
// disallows them; token-gated pages must not be crawled). Auth-gated pages
// like /lawyer-application/status are excluded even though their parent is
// public: crawlers would only ever see a login redirect.
function siteBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dealenz.site").replace(/\/$/, "")
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteBase()
  const pages = ["/", "/login", "/register", "/terms", "/privacy", "/help", "/lawyer-application"]
  return pages.map((path) => ({
    url: `${base}${path}`,
  }))
}
