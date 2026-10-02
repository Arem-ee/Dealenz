"use server"

import { createClient } from "@/lib/supabase/server"
import {
  MAX_RULE_CHARS,
  MAX_STANDING_RULES,
  normalizeRuleDealTypes,
} from "@/lib/standing/rules"

export interface Position {
  id: string
  text: string
  dealTypes: string[]
  createdAt: string
}

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

function toPosition(row: Record<string, unknown>): Position | null {
  if (typeof row.id !== "string" || typeof row.text !== "string") return null
  return {
    id: row.id,
    text: row.text,
    dealTypes: normalizeRuleDealTypes(row.deal_types),
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  }
}

/** Standing positions, oldest first — foundational rules survive. */
export async function listPositions(): Promise<ActionOk<{ positions: Position[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data, error } = await supabase
    .from("standing_instructions")
    .select("id, text, deal_types, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
  if (error) return { ok: false, error: "We couldn't load your positions. Please try again." }
  const positions = ((data ?? []) as Array<Record<string, unknown>>)
    .map(toPosition)
    .filter((p): p is Position => p !== null)
  return { ok: true, positions }
}

export async function addPosition(input: { text: string; dealTypes?: string[] }): Promise<
  ActionOk<{ position: Position }> | ActionFail
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const text = input.text.trim().slice(0, MAX_RULE_CHARS)
  if (!text) return { ok: false, error: "Write the position first." }
  const scope = normalizeRuleDealTypes(input.dealTypes)

  const { count } = await supabase
    .from("standing_instructions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
  if ((count ?? 0) >= MAX_STANDING_RULES) {
    return { ok: false, error: `Positions top out at ${MAX_STANDING_RULES} — remove one first. Short sets beat long ones.` }
  }
  const { data, error } = await supabase
    .from("standing_instructions")
    .insert({ user_id: user.id, text, deal_types: scope })
    .select("id, text, deal_types, created_at")
    .single()
  if (error || !data) return { ok: false, error: "We couldn't save that position. Please try again." }
  const position = toPosition(data as Record<string, unknown>)
  if (!position) return { ok: false, error: "We couldn't save that position. Please try again." }
  return { ok: true, position }
}

export async function updatePosition(input: { id: string; text: string; dealTypes?: string[] }): Promise<
  ActionOk<{ position: Position }> | ActionFail
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (!input.id.trim()) return { ok: false, error: "That position no longer exists." }
  const text = input.text.trim().slice(0, MAX_RULE_CHARS)
  if (!text) return { ok: false, error: "Write the position first." }
  const patch: Record<string, unknown> = { text }
  if (input.dealTypes !== undefined) patch.deal_types = normalizeRuleDealTypes(input.dealTypes)
  const { data, error } = await supabase
    .from("standing_instructions")
    .update(patch)
    .eq("id", input.id.trim())
    .eq("user_id", user.id)
    .select("id, text, deal_types, created_at")
    .maybeSingle()
  if (error || !data) return { ok: false, error: "We couldn't save that position. Please try again." }
  const position = toPosition(data as Record<string, unknown>)
  if (!position) return { ok: false, error: "We couldn't save that position. Please try again." }
  return { ok: true, position }
}

export async function deletePosition(input: { id: string }): Promise<ActionOk<{ deleted: boolean }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (!input.id.trim()) return { ok: false, error: "That position no longer exists." }
  const { error } = await supabase
    .from("standing_instructions")
    .delete()
    .eq("id", input.id.trim())
    .eq("user_id", user.id)
  if (error) return { ok: false, error: "We couldn't delete that position. Please try again." }
  return { ok: true, deleted: true }
}
