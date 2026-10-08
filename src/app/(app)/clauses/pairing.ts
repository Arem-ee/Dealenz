"use server"

import { createClient } from "@/lib/supabase/server"
import { isLibraryVariant, type LibraryClauseVariant } from "@/lib/library/entries"

export interface PositionLinkView {
  id: string
  positionId: string
  libraryKey: string
  variant: LibraryClauseVariant
  rung: number
  conditionText: string
  escalate: boolean
  insertOnMissing: boolean
  languageTitle: string
  languageBody: string
  languageVersion: number
}

export interface PositionWithLinks {
  id: string
  text: string
  links: PositionLinkView[]
}

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

/**
 * Positions with their linked library language (D1–D2). The preferred slot
 * is the standing wording reused verbatim; fallback rungs carry when/why;
 * walk-away is the floor. Bodies resolve to the latest usable version, so
 * one library update propagates to every linked position.
 */
export async function listPositionLinks(): Promise<ActionOk<{ positions: PositionWithLinks[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data: positions } = await supabase
    .from("standing_instructions")
    .select("id, text")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(20)
  const { data: linkRows } = await supabase
    .from("position_clause_links")
    .select("id, position_id, library_key, variant, rung, condition_text, escalate, insert_on_missing")
    .eq("user_id", user.id)
    .order("rung", { ascending: true })
    .limit(200)
  const { data: libRows } = await supabase
    .from("library_clauses")
    .select("id, key, variant, version, title, body, status")
    .eq("user_id", user.id)
    .limit(500)
  const heads = new Map<string, { title: string; body: string; version: number }>()
  for (const r of ((libRows ?? []) as Array<{
    key: string; variant: unknown; version: number; title: string; body: string; status: unknown
  }>)) {
    if (!isLibraryVariant(r.variant)) continue
    if (r.status !== "active" && r.status !== "deprecated") continue
    if (typeof r.title !== "string" || typeof r.body !== "string" || typeof r.version !== "number") continue
    const slot = `${r.key}:${r.variant}`
    const cur = heads.get(slot)
    if (!cur || r.version > cur.version) heads.set(slot, { title: r.title, body: r.body, version: r.version })
  }
  const byPosition = new Map<string, PositionLinkView[]>()
  for (const l of ((linkRows ?? []) as Array<{
    id: string; position_id: string; library_key: string; variant: unknown; rung: number;
    condition_text: string | null; escalate: boolean; insert_on_missing: boolean
  }>)) {
    if (!isLibraryVariant(l.variant)) continue
    const head = heads.get(`${l.library_key}:${l.variant}`)
    if (!head) continue
    const list = byPosition.get(l.position_id) ?? []
    list.push({
      id: l.id,
      positionId: l.position_id,
      libraryKey: l.library_key,
      variant: l.variant,
      rung: l.rung,
      conditionText: l.condition_text ?? "",
      escalate: l.escalate === true,
      insertOnMissing: l.insert_on_missing === true,
      languageTitle: head.title,
      languageBody: head.body,
      languageVersion: head.version,
    })
    byPosition.set(l.position_id, list)
  }
  const slot: Record<LibraryClauseVariant, number> = { preferred: 0, fallback: 1, walkaway: 2 }
  return {
    ok: true,
    positions: ((positions ?? []) as Array<{ id: string; text: string }>).map((p) => ({
      id: p.id,
      text: p.text,
      links: (byPosition.get(p.id) ?? []).sort(
        (a, b) => slot[a.variant] - slot[b.variant] || a.rung - b.rung
      ),
    })),
  }
}

interface LinkInput {
  positionId: string
  libraryKey: string
  variant: LibraryClauseVariant
  condition?: string
  escalate?: boolean
  insertOnMissing?: boolean
}

function validatedLinkInput(input: LinkInput):
  | { ok: true; condition: string; escalate: boolean; insertOnMissing: boolean }
  | { ok: false; error: string } {
  if (!isLibraryVariant(input.variant)) return { ok: false, error: "Unknown variant." }
  const condition = typeof input.condition === "string" ? input.condition.trim().slice(0, 500) : ""
  // Preferred is the standing wording, never a concession: condition-free.
  // The walk-away floor triggers on ladder exhaustion, not on conditions.
  // Fallbacks fire at discretion, so they must say when.
  if (input.variant === "fallback" && !condition) {
    return { ok: false, error: "Fallbacks need a when/why — say when to offer this rung." }
  }
  if (input.variant !== "fallback" && condition) {
    return { ok: false, error: "Conditions belong on fallback rungs only." }
  }
  // Silence names its insert variant: only the preferred link may carry it.
  if (input.insertOnMissing === true && input.variant !== "preferred") {
    return { ok: false, error: "Only the preferred link names the insertion language." }
  }
  // Preferred never escalates — it is the opening, not the last resort.
  if (input.escalate === true && input.variant === "preferred") {
    return { ok: false, error: "Escalation belongs on fallback rungs or the walk-away floor." }
  }
  return { ok: true, condition, escalate: input.escalate === true, insertOnMissing: input.insertOnMissing === true }
}

/**
 * Links a position to exact library language. One link per
 * position+line+variant; fallback rungs auto-stack best-first.
 */
export async function linkPosition(input: LinkInput): Promise<
  ActionOk<{ link: PositionLinkView }> | ActionFail
> {
  const checked = validatedLinkInput(input)
  if (!checked.ok) return checked
  const key = (input.libraryKey ?? "").trim()
  if (!key) return { ok: false, error: "Pick library language first." }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data: position } = await supabase
    .from("standing_instructions")
    .select("id")
    .eq("id", (input.positionId ?? "").trim())
    .eq("user_id", user.id)
    .maybeSingle()
  if (!position) return { ok: false, error: "That position no longer exists." }
  // The line+variant must exist and be usable — links never dangle.
  const { data: line } = await supabase
    .from("library_clauses")
    .select("id, title, body, version, status")
    .eq("user_id", user.id)
    .eq("key", key)
    .eq("variant", input.variant)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  const head = line as { id: string; title: string; body: string; version: number; status: string } | null
  if (!head) return { ok: false, error: "That library language is gone — pick a live version." }
  const { data: siblings } = await supabase
    .from("position_clause_links")
    .select("rung")
    .eq("user_id", user.id)
    .eq("position_id", (position as { id: string }).id)
    .eq("variant", "fallback")
  const rung = input.variant === "fallback"
    ? ((siblings ?? []) as Array<{ rung: number }>).reduce((m, s) => Math.max(m, s.rung), 0) + 1
    : 0
  const { data, error } = await supabase
    .from("position_clause_links")
    .insert({
      user_id: user.id,
      position_id: (position as { id: string }).id,
      library_key: key,
      variant: input.variant,
      rung,
      condition_text: checked.condition,
      escalate: checked.escalate,
      insert_on_missing: checked.insertOnMissing,
    })
    .select("id")
    .single()
  if (error || !data) {
    const msg = (error?.message ?? "").toLowerCase()
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false, error: "Already linked — edit the existing rung." }
    }
    return { ok: false, error: "We couldn't link that language. Please try again." }
  }
  return {
    ok: true,
    link: {
      id: (data as { id: string }).id,
      positionId: (position as { id: string }).id,
      libraryKey: key,
      variant: input.variant,
      rung,
      conditionText: checked.condition,
      escalate: checked.escalate,
      insertOnMissing: checked.insertOnMissing,
      languageTitle: head.title,
      languageBody: head.body,
      languageVersion: head.version,
    },
  }
}

/** Edits a link's condition and flags. Language and rung are immutable — relink instead. */
export async function updatePositionLink(input: {
  id: string
  condition?: string
  escalate?: boolean
  insertOnMissing?: boolean
}): Promise<ActionOk<{ updated: boolean }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data: existing } = await supabase
    .from("position_clause_links")
    .select("id, variant")
    .eq("id", (input.id ?? "").trim())
    .eq("user_id", user.id)
    .maybeSingle()
  const row = existing as { id: string; variant: LibraryClauseVariant } | null
  if (!row || !isLibraryVariant(row.variant)) return { ok: false, error: "That link no longer exists." }
  const patch: Record<string, unknown> = {}
  if (input.condition !== undefined) {
    const condition = input.condition.trim().slice(0, 500)
    if (row.variant === "fallback" && !condition) {
      return { ok: false, error: "Fallbacks need a when/why — say when to offer this rung." }
    }
    if (row.variant !== "fallback" && condition) {
      return { ok: false, error: "Conditions belong on fallback rungs only." }
    }
    patch.condition_text = condition
  }
  if (input.escalate !== undefined) {
    if (input.escalate && row.variant === "preferred") {
      return { ok: false, error: "Escalation belongs on fallback rungs or the walk-away floor." }
    }
    patch.escalate = input.escalate
  }
  if (input.insertOnMissing !== undefined) {
    if (input.insertOnMissing && row.variant !== "preferred") {
      return { ok: false, error: "Only the preferred link names the insertion language." }
    }
    patch.insert_on_missing = input.insertOnMissing
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to save." }
  const { error } = await supabase
    .from("position_clause_links")
    .update(patch)
    .eq("id", row.id)
    .eq("user_id", user.id)
  if (error) return { ok: false, error: "We couldn't save that link. Please try again." }
  return { ok: true, updated: true }
}

/** Removes a link. Language and position both survive — only the binding goes. */
export async function unlinkPosition(input: {
  id: string
}): Promise<ActionOk<{ cleared: boolean }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { error } = await supabase
    .from("position_clause_links")
    .delete()
    .eq("id", (input.id ?? "").trim())
    .eq("user_id", user.id)
  if (error) return { ok: false, error: "We couldn't remove that link. Please try again." }
  return { ok: true, cleared: true }
}
