"use server"

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { encryptSecret, validateKeyShape } from "@/lib/models/crypto"
import { isMissingTableError, listModelKeys, type ModelKeyRow } from "@/lib/models/store"
import { isSafeByokBaseUrl } from "@/lib/ai/providers/openai-compatible"
import type { ByokProvider } from "@/lib/models/run"
import { isLocale, LOCALE_COOKIE, type AppLocale } from "@/lib/i18n/locale"

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

/** Profile interface locale (personal layer, like model keys). */
export async function getLocale(): Promise<ActionOk<{ locale: AppLocale }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data } = await supabase
    .from("business_profiles")
    .select("locale")
    .eq("user_id", user.id)
    .maybeSingle()
  const locale = (data as { locale?: unknown } | null)?.locale
  return { ok: true, locale: isLocale(locale) ? locale : "en" }
}

/**
 * Persists the interface locale to the profile AND the request cookie, so
 * the choice applies immediately without a login round-trip. Unknown values
 * fail closed to English rather than storing garbage.
 */
export async function saveLocale(input: {
  locale: string
}): Promise<ActionOk<{ locale: AppLocale }> | ActionFail> {
  const locale = isLocale(input.locale) ? input.locale : "en"
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { error } = await supabase.from("business_profiles").upsert(
    { user_id: user.id, locale, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  )
  if (error) {
    if (error.message.includes("business_profiles") || error.message.includes("locale")) {
      return { ok: false, error: "Language preference needs a database update (migration 00121). Please try again after migrating." }
    }
    return { ok: false, error: "We couldn't save that preference. Please try again." }
  }
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" })
  return { ok: true, locale }
}

const PROVIDERS: ByokProvider[] = ["anthropic", "openai_compatible", "gemini"]

function cleanModels(models: unknown): string[] {
  if (Array.isArray(models)) {
    return [...new Set(models.filter((m): m is string => typeof m === "string").map((m) => m.trim()).filter(Boolean))].slice(0, 20)
  }
  if (typeof models === "string") {
    return [...new Set(models.split(/[,\n]/).map((m) => m.trim()).filter(Boolean))].slice(0, 20)
  }
  return []
}

/** Keys without secrets — safe for the client. Empty until migration 00092. */
export async function listKeys(): Promise<ActionOk<{ keys: ModelKeyRow[]; storageReady: boolean }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  try {
    const { rows, missing } = await listModelKeys(supabase as never, user.id)
    return { ok: true, keys: rows, storageReady: !missing }
  } catch {
    return { ok: false, error: "We couldn't load your keys. Please try again." }
  }
}

/** Add a key: format-checked now, live-verified on first use (failures mark the key, never pass silently). */
export async function addKey(input: {
  provider: string
  label: string
  secret: string
  models: string[] | string
  baseUrl?: string
}): Promise<ActionOk<{ id: string }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (!PROVIDERS.includes(input.provider as ByokProvider)) return { ok: false, error: "Unknown provider." }

  const label = input.label.trim().slice(0, 80)
  if (!label) return { ok: false, error: "Name that key so you can tell it apart." }
  const shapeError = validateKeyShape(input.provider, input.secret.trim())
  if (shapeError) return { ok: false, error: shapeError }
  const models = cleanModels(input.models)
  if (models.length === 0) return { ok: false, error: "List at least one model this key may use." }
  const baseUrl = (input.baseUrl ?? "").trim()
  if (input.provider !== "openai_compatible" && baseUrl) {
    return { ok: false, error: "A custom endpoint only applies to OpenAI-compatible keys." }
  }
  if (baseUrl) {
    const check = isSafeByokBaseUrl(baseUrl)
    if (!check.ok) return { ok: false, error: `That endpoint is not allowed (${check.reason ?? "unsafe"}). Use a public HTTPS endpoint.` }
  }

  let secretEnc: string
  try {
    secretEnc = encryptSecret(input.secret.trim())
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Key storage isn't configured." }
  }
  try {
    const { data, error } = await supabase
      .from("user_model_keys")
      .insert({
        user_id: user.id,
        provider: input.provider,
        label,
        secret_enc: secretEnc,
        models,
        base_url: baseUrl || null,
      })
      .select("id")
      .single()
    if (error || !data) {
      if (error && isMissingTableError(error)) {
        return { ok: false, error: "Key storage isn't set up yet (migration 00092). Your key was never saved." }
      }
      return { ok: false, error: "We couldn't save that key. Please try again." }
    }
    return { ok: true, id: (data as { id: string }).id }
  } catch (err) {
    if (isMissingTableError(err)) {
      return { ok: false, error: "Key storage isn't set up yet (migration 00092). Your key was never saved." }
    }
    return { ok: false, error: "We couldn't save that key. Please try again." }
  }
}

/** Revoke a key: timestamped, immediate, never deleted (audit keeps who held what). */
export async function revokeKey(input: { id: string }): Promise<ActionOk<{ revoked: boolean }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  try {
    const { error } = await supabase
      .from("user_model_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("user_id", user.id)
      .is("revoked_at", null)
    if (error) {
      if (isMissingTableError(error)) return { ok: false, error: "Key storage isn't set up yet (migration 00092)." }
      return { ok: false, error: "We couldn't revoke that key. Please try again." }
    }
    return { ok: true, revoked: true }
  } catch (err) {
    if (isMissingTableError(err)) return { ok: false, error: "Key storage isn't set up yet (migration 00092)." }
    return { ok: false, error: "We couldn't revoke that key. Please try again." }
  }
}

/** Rotate a key's secret (and optionally its models): old secret dies with the update. */
export async function rotateKey(input: { id: string; secret: string; models?: string[] | string }): Promise<
  ActionOk<{ rotated: boolean }> | ActionFail
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  try {
    const { data: row, error: readError } = await supabase
      .from("user_model_keys")
      .select("id, provider")
      .eq("id", input.id)
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .maybeSingle()
    if (readError || !row) {
      if (readError && isMissingTableError(readError)) {
        return { ok: false, error: "Key storage isn't set up yet (migration 00092)." }
      }
      return { ok: false, error: "That key is gone." }
    }
    const provider = (row as { provider: string }).provider
    const shapeError = validateKeyShape(provider, input.secret.trim())
    if (shapeError) return { ok: false, error: shapeError }
    const models = input.models === undefined ? undefined : cleanModels(input.models)
    if (models !== undefined && models.length === 0) return { ok: false, error: "List at least one model this key may use." }
    let secretEnc: string
    try {
      secretEnc = encryptSecret(input.secret.trim())
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Key storage isn't configured." }
    }
    const patch: Record<string, unknown> = { secret_enc: secretEnc, last_error: null }
    if (models !== undefined) patch.models = models
    const { error } = await supabase.from("user_model_keys").update(patch).eq("id", input.id).eq("user_id", user.id)
    if (error) return { ok: false, error: "We couldn't rotate that key. Please try again." }
    return { ok: true, rotated: true }
  } catch (err) {
    if (isMissingTableError(err)) return { ok: false, error: "Key storage isn't set up yet (migration 00092)." }
    return { ok: false, error: "We couldn't rotate that key. Please try again." }
  }
}
