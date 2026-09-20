import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dealenz.site").replace(/\/$/, "")
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/audit/",
        "/dashboard",
        "/ask",
        "/chat",
        "/deals",
        "/billing",
        "/lawyer",
        "/admin",
        "/document",
        "/review",
        "/library",
        "/vault",
        "/settings",
        "/risk-intelligence",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
