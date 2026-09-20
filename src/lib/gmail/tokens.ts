// Gmail token storage — server-side only, RLS, no service_role, no browser exposure.
// Tokens are stored in gmail_tokens (user_id PK, access_token, refresh_token, expiry_date).
// Refresh and send use server-side handlers.

import type { SupabaseClient } from "@supabase/supabase-js"

type Client = SupabaseClient

export interface GmailTokens {
  user_id: string
  access_token: string
  refresh_token: string
  scope: string
  token_type: string
  expiry_date: string
  granted_at: string
  updated_at: string
}

export async function getGmailTokens(client: Client, userId: string): Promise<GmailTokens | null> {
  const { data, error } = await client.from("gmail_tokens").select("*").eq("user_id", userId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as GmailTokens | null) ?? null
}

export async function upsertGmailTokens(
  client: Client,
  userId: string,
  tokens: { access_token: string; refresh_token: string; expiry_date: string; scope?: string; token_type?: string }
): Promise<GmailTokens> {
  const { data, error } = await client
    .from("gmail_tokens")
    .upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope ?? "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
      token_type: tokens.token_type ?? "Bearer",
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed to store Gmail tokens")
  return data as GmailTokens
}

export async function refreshAccessToken(client: Client, userId: string, refreshFn: (refreshToken: string) => Promise<{ access_token: string; expiry_date: string }>): Promise<GmailTokens | null> {
  const tokens = await getGmailTokens(client, userId)
  if (!tokens) return null
  if (new Date(tokens.expiry_date).getTime() - Date.now() > 60_000) return tokens // still valid
  const refreshed = await refreshFn(tokens.refresh_token)
  return upsertGmailTokens(client, userId, { access_token: refreshed.access_token, refresh_token: tokens.refresh_token, expiry_date: refreshed.expiry_date })
}

export function isTokenValid(tokens: GmailTokens | null): boolean {
  if (!tokens) return false
  return new Date(tokens.expiry_date).getTime() > Date.now() + 60_000
}

// Server-side refresh against Google's token endpoint using the
// configured OAuth client. Throws a plain actionable message when the
// OAuth app is not configured or the refresh fails — callers surface it
// instead of fabricating delivery.
export async function refreshGmailAccessToken(refreshToken: string): Promise<{ access_token: string; expiry_date: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error("Gmail is not configured — connect Gmail again once setup is complete")
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  const data = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null
  if (!res.ok || !data?.access_token) throw new Error("Gmail token refresh failed — re-authorize Gmail")
  return { access_token: data.access_token, expiry_date: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString() }
}

// Valid tokens, refreshing once when expiring. Returns null when Gmail
// was never connected; throws only on refresh failure.
export async function getValidGmailTokens(client: Client, userId: string): Promise<GmailTokens | null> {
  const tokens = await getGmailTokens(client, userId)
  if (!tokens) return null
  if (isTokenValid(tokens)) return tokens
  return refreshAccessToken(client, userId, refreshGmailAccessToken)
}
