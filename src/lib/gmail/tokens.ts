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
