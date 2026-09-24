"use server"

import { createClient } from "@/lib/supabase/server"
import { MAX_RULE_CHARS, MAX_STANDING_RULES } from "@/lib/standing/rules"

export interface StandingRule {
  id: string
  text: string
  created_at: string
}

export type StandingRulesResult =
  | { ok: true; rules: StandingRule[] }
  | { ok: false; error: string }

type AddRuleResult =
  | { ok: true; rule: StandingRule }
  | { ok: false; error: string }

type DeleteRuleResult =
  | { ok: true }
  | { ok: false; error: string }

async function authedUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

function toStandingRule(row: unknown): StandingRule | null {
  const r = (row ?? {}) as Record<string, unknown>
  if (typeof r.id !== "string" || typeof r.text !== "string") return null
  return { id: r.id, text: r.text, created_at: typeof r.created_at === "string" ? r.created_at : "" }
}

export async function listStandingRules(): Promise<StandingRulesResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  try {
    const { data, error } = await supabase
      .from("standing_instructions")
      .select("id, text, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(MAX_STANDING_RULES)
    if (error) return { ok: false, error: "We couldn't load your rules. Please try again." }
    const rules = ((data ?? []) as unknown[]).map(toStandingRule).filter((r): r is StandingRule => r !== null)
    return { ok: true, rules }
  } catch {
    return { ok: false, error: "We couldn't load your rules. Please try again." }
  }
}

export async function addStandingRule(input: string): Promise<AddRuleResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const text = input.trim().slice(0, MAX_RULE_CHARS)
  if (!text) return { ok: false, error: "Write the rule first." }
  try {
    const { data: existing, error: countError } = await supabase
      .from("standing_instructions")
      .select("id")
      .eq("user_id", user.id)
      .limit(MAX_STANDING_RULES + 1)
    if (countError) return { ok: false, error: "We couldn't save your rule. Please try again." }
    if (((existing ?? []) as unknown[]).length >= MAX_STANDING_RULES) {
      return { ok: false, error: `You already have ${MAX_STANDING_RULES} rules. Delete one to add another.` }
    }
    const { data, error } = await supabase
      .from("standing_instructions")
      .insert({ user_id: user.id, text })
      .select("id, text, created_at")
      .single()
    if (error || !data) return { ok: false, error: "We couldn't save your rule. Please try again." }
    const rule = toStandingRule(data)
    if (!rule) return { ok: false, error: "We couldn't save your rule. Please try again." }
    return { ok: true, rule }
  } catch {
    return { ok: false, error: "We couldn't save your rule. Please try again." }
  }
}

export async function deleteStandingRule(id: string): Promise<DeleteRuleResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (!id.trim()) return { ok: false, error: "That rule no longer exists." }
  try {
    const { error } = await supabase
      .from("standing_instructions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
    if (error) return { ok: false, error: "We couldn't delete that rule. Please try again." }
    return { ok: true }
  } catch {
    return { ok: false, error: "We couldn't delete that rule. Please try again." }
  }
}

// Loader for prompt wiring: standing rule texts, oldest first. Never throws
// and never exposes other users' rows (owner-scoped query plus RLS). Empty
// on any failure: missing rules must never break an answer.
export async function getStandingRuleTexts(): Promise<string[]> {
  try {
    const userId = await authedUserId()
    if (!userId) return []
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("standing_instructions")
      .select("text")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(MAX_STANDING_RULES)
    if (error || !data) return []
    return ((data ?? []) as Array<{ text?: unknown }>)
      .map((r) => (typeof r.text === "string" ? r.text.trim() : ""))
      .filter((t) => t.length > 0)
  } catch {
    return []
  }
}
