// Canonical server/client configuration boundary (Phase 12).
//
// Single place that turns raw environment into validated Supabase public
// config with clear boot errors. Provider/commerce validation stays where
// it already lives (src/lib/billing/provider.ts for Lemon Squeezy,
// src/lib/ai/providers.ts for AI) — this module does not duplicate it.
//
// Rules: never leak a secret value into an error; accept CI dummy shapes
// (https://example.supabase.co); reject empty, non-http(s), and obvious
// unedited placeholders ("your-...").

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export interface SupabasePublicConfig {
  url: string
  anonKey: string
}

export function supabasePublicConfig(): SupabasePublicConfig {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim()
  if (!url || url.includes("your-")) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL: set the Supabase project URL (server and client)."
    )
  }
  if (!isHttpUrl(url)) {
    throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL: expected an absolute http(s) URL.")
  }
  if (!anonKey || anonKey.includes("your-")) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY: set the Supabase anonymous key.")
  }
  return { url, anonKey }
}
