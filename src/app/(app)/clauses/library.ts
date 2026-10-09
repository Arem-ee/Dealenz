"use server"

import { createClient } from "@/lib/supabase/server"
import { normalizeRuleDealTypes } from "@/lib/standing/rules"
import { clauseById, CLAUSE_LIBRARY } from "@/lib/protection/clauses"
import {
  canVersion,
  customClauseKey,
  isLibraryLanguage,
  isLibraryVariant,
  normalizeLibraryBody,
  normalizeLibraryCategory,
  normalizeLibraryTitle,
  standardClauseKey,
  type LibraryClauseStatus,
  type LibraryClauseVariant,
  type LibraryLanguage,
} from "@/lib/library/entries"

export interface LibraryEntry {
  id: string
  key: string
  variant: LibraryClauseVariant
  language: LibraryLanguage
  version: number
  title: string
  body: string
  category: string
  dealTypes: string[]
  status: LibraryClauseStatus
  changeNote: string
  templateId: string | null
  templateVersion: number | null
  useCount: number
  lastUsedAt: string | null
  createdAt: string
}

export interface StandardClauseOption {
  id: string
  title: string
  purpose: string
  categories: string[]
  dealTypes: string[]
  version: number
  inLibrary: boolean
}

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

function toEntry(row: Record<string, unknown>): LibraryEntry | null {
  if (typeof row.id !== "string" || typeof row.key !== "string" || typeof row.title !== "string") return null
  if (typeof row.body !== "string") return null
  const status = row.status
  if (status !== "active" && status !== "deprecated" && status !== "superseded") return null
  const variant = isLibraryVariant(row.variant) ? row.variant : "preferred"
  // Pre-language rows read as English (migration default).
  const language = isLibraryLanguage(row.language) ? row.language : "en"
  return {
    id: row.id,
    key: row.key,
    variant,
    language,
    version: typeof row.version === "number" ? row.version : 1,
    title: row.title,
    body: row.body,
    category: typeof row.category === "string" ? row.category : "general",
    dealTypes: Array.isArray(row.deal_types) ? row.deal_types.filter((d): d is string => typeof d === "string") : [],
    status,
    changeNote: typeof row.change_note === "string" ? row.change_note : "",
    templateId: typeof row.template_id === "string" ? row.template_id : null,
    templateVersion: typeof row.template_version === "number" ? row.template_version : null,
    useCount: typeof row.use_count === "number" ? row.use_count : 0,
    lastUsedAt: typeof row.last_used_at === "string" ? row.last_used_at : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  }
}

const ENTRY_COLUMNS = "id, key, variant, language, version, title, body, category, deal_types, status, change_note, template_id, template_version, use_count, last_used_at, created_at"

/** Full version history for every library line, oldest first. */
export async function listLibrary(): Promise<ActionOk<{ entries: LibraryEntry[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data, error } = await supabase
    .from("library_clauses")
    .select(ENTRY_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(500)
  if (error) return { ok: false, error: "We couldn't load your library. Please try again." }
  const entries = ((data ?? []) as Array<Record<string, unknown>>)
    .map(toEntry)
    .filter((e): e is LibraryEntry => e !== null)
  return { ok: true, entries }
}

/** Code-owned standard clauses with library membership, for the Save path. */
export async function listStandardClauses(): Promise<ActionOk<{ clauses: StandardClauseOption[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data } = await supabase.from("library_clauses").select("key").eq("user_id", user.id).limit(500)
  const saved = new Set(((data ?? []) as Array<{ key: string }>).map((r) => r.key))
  return {
    ok: true,
    clauses: CLAUSE_LIBRARY.map((c) => ({
      id: c.id,
      title: c.title,
      purpose: c.purpose,
      categories: [...c.protectionCategories],
      dealTypes: [...c.dealTypes],
      version: c.version,
      inLibrary: saved.has(standardClauseKey(c.id)),
    })),
  }
}

/**
 * Snapshots a standard clause into the library as version 1 of the chosen
 * variant, with template provenance. One snapshot per template+variant —
 * further changes are new versions of the saved line, never second
 * snapshots.
 */
export async function saveStandardClause(input: {
  templateId: string
  variant?: LibraryClauseVariant
}): Promise<ActionOk<{ entry: LibraryEntry }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const template = clauseById(input.templateId)
  if (!template) return { ok: false, error: "Unknown standard clause." }
  const variant = isLibraryVariant(input.variant) ? input.variant : "preferred"
  const key = standardClauseKey(template.id)
  const { data: existing } = await supabase
    .from("library_clauses")
    .select("id")
    .eq("user_id", user.id)
    .eq("key", key)
    .eq("variant", variant)
    .limit(1)
  if ((existing ?? []).length > 0) return { ok: false, error: "Already in your library — edit it there." }
  const { data, error } = await supabase
    .from("library_clauses")
    .insert({
      user_id: user.id,
      key,
      variant,
      version: 1,
      title: template.title,
      body: template.template,
      category: template.protectionCategories[0] ?? "general",
      deal_types: [...template.dealTypes],
      status: "active",
      change_note: "Saved from the standard clause set.",
      template_id: template.id,
      template_version: template.version,
    })
    .select(ENTRY_COLUMNS)
    .single()
  if (error || !data) return { ok: false, error: "We couldn't save that clause. Please try again." }
  const entry = toEntry(data as Record<string, unknown>)
  if (!entry) return { ok: false, error: "We couldn't save that clause. Please try again." }
  return { ok: true, entry }
}

/** Authors a custom library line at version 1 of the chosen variant and language. */
export async function addCustomClause(input: {
  title: string
  body: string
  category?: string
  dealTypes?: string[]
  variant?: LibraryClauseVariant
  language?: LibraryLanguage
}): Promise<ActionOk<{ entry: LibraryEntry }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const title = normalizeLibraryTitle(input.title)
  if (!title) return { ok: false, error: "Give the clause a title first." }
  const body = normalizeLibraryBody(input.body)
  if (!body) return { ok: false, error: "Write the clause language first." }
  const variant = isLibraryVariant(input.variant) ? input.variant : "preferred"
  // Approved language only — machine translation never writes library rows.
  const language = isLibraryLanguage(input.language) ? input.language : "en"
  const key = customClauseKey(title)
  const { data: existing } = await supabase
    .from("library_clauses")
    .select("id")
    .eq("user_id", user.id)
    .eq("key", key)
    .eq("variant", variant)
    .eq("language", language)
    .limit(1)
  if ((existing ?? []).length > 0) return { ok: false, error: "That variant already exists for this title and language." }
  const { data, error } = await supabase
    .from("library_clauses")
    .insert({
      user_id: user.id,
      key,
      variant,
      language,
      version: 1,
      title,
      body,
      category: normalizeLibraryCategory(input.category),
      deal_types: normalizeRuleDealTypes(input.dealTypes),
      status: "active",
      change_note: "Custom clause added.",
    })
    .select(ENTRY_COLUMNS)
    .single()
  if (error || !data) return { ok: false, error: "We couldn't save that clause. Please try again." }
  const entry = toEntry(data as Record<string, unknown>)
  if (!entry) return { ok: false, error: "We couldn't save that clause. Please try again." }
  return { ok: true, entry }
}

/**
 * Adds a missing variant to an existing line at version 1, seeded from the
 * preferred head's title/category/scope (body starts as a copy to edit, or
 * the caller's draft). Completing the three-tier set is the industry bar —
 * a line without walkaway concedes under pressure.
 */
export async function addLineVariant(input: {
  key: string
  variant: LibraryClauseVariant
  body?: string
}): Promise<ActionOk<{ entry: LibraryEntry }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (!isLibraryVariant(input.variant) || input.variant === "preferred") {
    return { ok: false, error: "Pick fallback or walk-away for a new variant." }
  }
  const key = (input.key ?? "").trim()
  if (!key) return { ok: false, error: "That clause no longer exists." }
  const { data: line } = await supabase
    .from("library_clauses")
    .select(ENTRY_COLUMNS)
    .eq("user_id", user.id)
    .eq("key", key)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(10)
  const rows = ((line ?? []) as Array<Record<string, unknown>>)
    .map(toEntry)
    .filter((e): e is LibraryEntry => e !== null)
  if (rows.length === 0) return { ok: false, error: "That clause no longer exists." }
  // Variant lines stay within one language — cross-language lines are
  // separate additions, not variants.
  if (rows.some((r) => r.variant === input.variant)) {
    return { ok: false, error: "That variant already exists for this line." }
  }
  const seed = rows.find((r) => r.variant === "preferred") ?? rows[0]!
  const body = typeof input.body === "string" && input.body.trim()
    ? input.body.trim().slice(0, 8000)
    : seed.body
  const { data, error } = await supabase
    .from("library_clauses")
    .insert({
      user_id: user.id,
      key,
      variant: input.variant,
      language: seed.language,
      version: 1,
      title: seed.title,
      body,
      category: seed.category,
      deal_types: seed.dealTypes,
      status: "active",
      change_note: `${input.variant === "walkaway" ? "Walk-away" : "Fallback"} position added.`,
      template_id: seed.templateId,
      template_version: seed.templateVersion,
    })
    .select(ENTRY_COLUMNS)
    .single()
  if (error || !data) return { ok: false, error: "We couldn't add that variant. Please try again." }
  const entry = toEntry(data as Record<string, unknown>)
  if (!entry) return { ok: false, error: "We couldn't add that variant. Please try again." }
  return { ok: true, entry }
}

/**
 * Saves an edit as a new version: the edited head is marked superseded and
 * the new row becomes version+1 (status active). History is never rewritten.
 */
export async function saveClauseVersion(input: {
  id: string
  title?: string
  body?: string
  changeNote?: string
}): Promise<ActionOk<{ entry: LibraryEntry }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (!input.id.trim()) return { ok: false, error: "That clause no longer exists." }
  const { data: head, error: headError } = await supabase
    .from("library_clauses")
    .select(ENTRY_COLUMNS)
    .eq("id", input.id.trim())
    .eq("user_id", user.id)
    .maybeSingle()
  if (headError || !head) return { ok: false, error: "That clause no longer exists." }
  const current = toEntry(head as Record<string, unknown>)
  if (!current) return { ok: false, error: "That clause no longer exists." }
  if (!canVersion(current.status)) return { ok: false, error: "Superseded versions are read-only." }
  // The edited row must still be the head of its variant+language — no silent forks.
  const { data: newer } = await supabase
    .from("library_clauses")
    .select("id")
    .eq("user_id", user.id)
    .eq("key", current.key)
    .eq("variant", current.variant)
    .eq("language", current.language)
    .gt("version", current.version)
    .limit(1)
  if ((newer ?? []).length > 0) return { ok: false, error: "A newer version exists — refresh first." }
  const title = input.title !== undefined ? normalizeLibraryTitle(input.title) : current.title
  const body = input.body !== undefined ? normalizeLibraryBody(input.body) : current.body
  if (!title) return { ok: false, error: "Give the clause a title first." }
  if (!body) return { ok: false, error: "Write the clause language first." }
  const changeNote = typeof input.changeNote === "string" ? input.changeNote.trim().slice(0, 280) : ""
  if (title === current.title && body === current.body) {
    return { ok: false, error: "No changes to save." }
  }
  const { error: supersedeError } = await supabase
    .from("library_clauses")
    .update({ status: "superseded" })
    .eq("id", current.id)
    .eq("user_id", user.id)
  if (supersedeError) return { ok: false, error: "We couldn't save that version. Please try again." }
  const { data, error } = await supabase
    .from("library_clauses")
    .insert({
      user_id: user.id,
      key: current.key,
      variant: current.variant,
      language: current.language,
      version: current.version + 1,
      title,
      body,
      category: current.category,
      deal_types: current.dealTypes,
      status: "active",
      change_note: changeNote,
      template_id: current.templateId,
      template_version: current.templateVersion,
    })
    .select(ENTRY_COLUMNS)
    .single()
  if (error || !data) return { ok: false, error: "We couldn't save that version. Please try again." }
  const entry = toEntry(data as Record<string, unknown>)
  if (!entry) return { ok: false, error: "We couldn't save that version. Please try again." }
  return { ok: true, entry }
}

/** Retires the head of a line without deleting its history. */
export async function deprecateClause(input: {
  id: string
}): Promise<ActionOk<{ entry: LibraryEntry }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (!input.id.trim()) return { ok: false, error: "That clause no longer exists." }
  const { data, error } = await supabase
    .from("library_clauses")
    .update({ status: "deprecated" })
    .eq("id", input.id.trim())
    .eq("user_id", user.id)
    .eq("status", "active")
    .select(ENTRY_COLUMNS)
    .maybeSingle()
  if (error || !data) return { ok: false, error: "Only the active version can be retired." }
  const entry = toEntry(data as Record<string, unknown>)
  if (!entry) return { ok: false, error: "We couldn't retire that clause. Please try again." }
  return { ok: true, entry }
}

export interface LocalizedOverride {
  clauseId: string
  body: string
  version: number
  language: string
}

/**
 * Resolves approved localized language for assembly: the latest usable
 * preferred-variant head per clause in the requested language. Clauses
 * without an approved line resolve to nothing — assembly falls back to
 * English and labels it. Best-effort read; failures resolve empty (all
 * English), never fail generation.
 */
export async function getLocalizedOverrides(input: {
  clauseIds: string[]
  language: string
}): Promise<{ overrides: LocalizedOverride[] }> {
  try {
    if (input.language !== "fr" && input.language !== "de") return { overrides: [] }
    const wanted = new Set((input.clauseIds ?? []).filter((id) => typeof id === "string"))
    if (wanted.size === 0) return { overrides: [] }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { overrides: [] }
    const { data } = await supabase
      .from("library_clauses")
      .select("key, variant, version, title, body, status, language")
      .eq("user_id", user.id)
      .eq("variant", "preferred")
      .eq("language", input.language)
      .in("key", [...wanted].map((id) => `std:${id.toLowerCase()}`))
      .limit(200)
    const best = new Map<string, { body: string; version: number }>()
    for (const r of ((data ?? []) as Array<{
      key: string; version: number; body: string; status: string
    }>)) {
      if (r.status !== "active" && r.status !== "deprecated") continue
      if (typeof r.body !== "string") continue
      const cur = best.get(r.key)
      if (!cur || r.version > cur.version) best.set(r.key, { body: r.body, version: r.version })
    }
    const overrides: LocalizedOverride[] = []
    for (const clauseId of wanted) {
      const hit = best.get(`std:${clauseId.toLowerCase()}`)
      if (hit) overrides.push({ clauseId, body: hit.body, version: hit.version, language: input.language })
    }
    return { overrides }
  } catch {
    return { overrides: [] }
  }
}

/**
 * Records library usage when a draft assembles clauses: bumps use_count and
 * stamps last_used_at on the user's saved snapshots of the given standard
 * template ids. Best-effort and silent — usage analytics must never fail a
 * draft. Called by draft generation, never by readers.
 */
export async function recordClauseUse(input: { templateIds: string[] }): Promise<void> {
  try {
    const ids = [...new Set((input.templateIds ?? []).filter((t) => typeof t === "string" && t.trim()))]
    if (ids.length === 0) return
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const keys = ids.map(standardClauseKey)
    const { data: rows } = await supabase
      .from("library_clauses")
      .select("id, use_count")
      .eq("user_id", user.id)
      .in("key", keys)
      .neq("status", "superseded")
    for (const r of ((rows ?? []) as Array<{ id: string; use_count: number | null }>)) {
      await supabase
        .from("library_clauses")
        .update({ use_count: (r.use_count ?? 0) + 1, last_used_at: new Date().toISOString() })
        .eq("id", r.id)
        .eq("user_id", user.id)
    }
  } catch {
    // Usage analytics never fail the caller.
  }
}

/**
 * Removes a whole line (every variant and version of the key). Deletion is
 * the only destructive path and it takes the full history — the UI confirms
 * first.
 */
export async function deleteClauseLine(input: {
  key: string
}): Promise<ActionOk<{ deleted: boolean }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (!input.key.trim()) return { ok: false, error: "That clause no longer exists." }
  const { error } = await supabase
    .from("library_clauses")
    .delete()
    .eq("user_id", user.id)
    .eq("key", input.key.trim())
  if (error) return { ok: false, error: "We couldn't delete that clause. Please try again." }
  return { ok: true, deleted: true }
}
