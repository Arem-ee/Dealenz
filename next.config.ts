import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';" },
      ],
    },
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
}

export default nextConfig
