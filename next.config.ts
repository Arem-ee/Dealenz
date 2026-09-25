import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // script-src keeps 'unsafe-inline' (required by Next.js hydration)
        // but drops 'unsafe-eval': no client dependency evaluates code.
        // AI provider calls run server-side, so connect-src stays narrow.
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        // allow-popups (not same-origin): OAuth/checkout use top-level
        // redirects, never cross-origin openers we must sever.
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
      ],
    },
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Barrel-import pruning for the icon sets used across the shell: without
    // this every page ships the whole library instead of the icons it names.
    optimizePackageImports: ["lucide-react", "react-icons"],
  },
}

export default nextConfig
