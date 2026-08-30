import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/audit/"],
    },
    sitemap: "https://dealenz.ai/sitemap.xml",
  }
}
