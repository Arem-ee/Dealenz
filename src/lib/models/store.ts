import type { SupabaseClient } from "@supabase/supabase-js"
import { decryptSecret } from "@/lib/models/crypto"
import type { ByokProvider } from "@/lib/models/run"

export interface ModelKeyRow {
  id: string
  provider: ByokProvider
  label: string
  models: string[]
  base_url: string | null
  created_at: string
  revoked_at: string | null
  last_used_at: string | null
  last_error: string | null
}

export interface ResolvedModelKey extends ModelKeyRow {
  apiKey: string
}

type Client = SupabaseClient

// True when the user_model_keys table hasn't been migrated yet. Callers
// treat this as "no keys configured" — an honest empty state, never a
// crash, until migration 00092 is applied.
export function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "")
  return /relation .* does not exist/i.test(msg) || /Could not find the table/i.test(msg)
}

function toRow(r: Record<string, unknown>): ModelKeyRow | null {
  if (typeof r.id !== "string") return null
  const provider = r.provider
  if (provider !== "anthropic" && provider !== "openai_compatible" && provider !== "gemini") return null
  return {
    id: r.id,
    provider,
    label: typeof r.label === "string" ? r.label : "Key",
    models: Array.isArray(r.models) ? r.models.filter((m): m is string => typeof m === "string") : [],
    base_url: typeof r.base_url === "string" ? r.base_url : null,
    created_at: typeof r.created_at === "string" ? r.created_at : "",
    revoked_at: typeof r.revoked_at === "string" ? r.revoked_at : null,
    last_used_at: typeof r.last_used_at === "string" ? r.last_used_at : null,
    last_error: typeof r.last_error === "string" ? r.last_error : null,
  }
}

export async function listModelKeys(client: Client, userId: string): Promise<{ rows: ModelKeyRow[]; missing: boolean }> {
  try {
    const { data, error } = await client
      .from("user_model_keys")
      .select("id, provider, label, models, base_url, created_at, revoked_at, last_used_at, last_error")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .order("created_at", { ascending: true })
    if (error) {
      if (isMissingTableError(error)) return { rows: [], missing: true }
      throw error
    }
    const rows = ((data ?? []) as Array<Record<string, unknown>>)
      .map(toRow)
      .filter((r): r is ModelKeyRow => r !== null)
    return { rows, missing: false }
  } catch (err) {
    if (isMissingTableError(err)) return { rows: [], missing: true }
    throw err
  }
}

// Loads one active key with its secret decrypted for the live call only.
// Throws owned-or-revoked failures as plain errors the caller surfaces.
export async function loadActiveKey(client: Client, userId: string, keyId: string): Promise<ResolvedModelKey> {
  const { data, error } = await client
    .from("user_model_keys")
    .select("id, provider, label, models, base_url, secret_enc, created_at, revoked_at, last_used_at, last_error")
    .eq("id", keyId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle()
  if (error) {
    if (isMissingTableError(error)) throw new Error("Model keys aren't set up yet.")
    throw new Error("We couldn't load that key.")
  }
  const row = data == null ? null : toRow(data as Record<string, unknown>)
  const secret = (data as Record<string, unknown> | null)?.secret_enc
  if (!row || typeof secret !== "string") throw new Error("That key is gone — pick another model.")
  return { ...row, apiKey: decryptSecret(secret) }
}

export async function touchKeyUsed(client: Client, userId: string, keyId: string, error: string | null): Promise<void> {
  try {
    await client
      .from("user_model_keys")
      .update({
        last_used_at: new Date().toISOString(),
        last_error: error,
      })
      .eq("id", keyId)
      .eq("user_id", userId)
  } catch {
    // Usage stamps never break the product path.
  }
}
