"use server"

import { createClient } from "@/lib/supabase/server"
import { MAX_RULE_CHARS, MAX_STANDING_RULES, normalizeRuleDealTypes, ruleAppliesToDeal } from "@/lib/standing/rules"

export interface StandingRule {
  id: string
  text: string
  created_at: string
  dealTypes: string[]
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

export async function updateStandingRule(id: string, input: string, dealTypes?: string[]): Promise<AddRuleResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (!id.trim()) return { ok: false, error: "That rule no longer exists." }
  const text = input.trim().slice(0, MAX_RULE_CHARS)
  if (!text) return { ok: false, error: "Write the rule first." }
  const scope = dealTypes === undefined ? undefined : normalizeRuleDealTypes(dealTypes)
  try {
    // Text-only edits omit the scope column so they keep working before
    // migration 00089 is applied; scope edits need the column.
    const patch: Record<string, unknown> = scope === undefined ? { text } : { text, deal_types: scope }
    const attempt = await supabase
      .from("standing_instructions")
      .update(patch)
      .eq("id", id.trim())
      .eq("user_id", user.id)
      .select("id, text, created_at")
      .maybeSingle()
    let data = attempt.data
    let error = attempt.error
    if (error && isMissingScopeColumn(error) && scope !== undefined) {
      if (scope.length > 0) {
        return { ok: false, error: "Rule scopes need a database update (migration 00089). Your text was not saved." }
      }
      const retry = await supabase
        .from("standing_instructions")
        .update({ text })
        .eq("id", id.trim())
        .eq("user_id", user.id)
        .select("id, text, created_at")
        .maybeSingle()
      data = retry.data
      error = retry.error
    }
    if (error || !data) return { ok: false, error: "We couldn't save your rule. Please try again." }
    const rule = toStandingRule(data)
    if (!rule) return { ok: false, error: "We couldn't save your rule. Please try again." }
    if (scope !== undefined) rule.dealTypes = scope
    return { ok: true, rule }
  } catch {
    return { ok: false, error: "We couldn't save your rule. Please try again." }
  }
}

function toStandingRule(row: unknown): StandingRule | null {
  const r = (row ?? {}) as Record<string, unknown>
  if (typeof r.id !== "string" || typeof r.text !== "string") return null
  return {
    id: r.id,
    text: r.text,
    created_at: typeof r.created_at === "string" ? r.created_at : "",
    dealTypes: normalizeRuleDealTypes(r.deal_types),
  }
}

function isMissingScopeColumn(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string" &&
    (error as { message: string }).message.includes("deal_types")
  )
}

export async function listStandingRules(): Promise<StandingRulesResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  try {
    // Scopes ride a best-effort second read so the list keeps working before
    // migration 00089 is applied; rows simply read as applying everywhere.
    const { data, error } = await supabase
      .from("standing_instructions")
      .select("id, text, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(MAX_STANDING_RULES)
    if (error) return { ok: false, error: "We couldn't load your rules. Please try again." }
    const rows = ((data ?? []) as unknown[]).map(toStandingRule).filter((r): r is StandingRule => r !== null)
    if (rows.length > 0) {
      const { data: scoped } = await supabase
        .from("standing_instructions")
        .select("id, deal_types")
        .eq("user_id", user.id)
        .in("id", rows.map((r) => r.id))
      if (Array.isArray(scoped)) {
        const byId = new Map(
          (scoped as Array<{ id: string; deal_types: unknown }>).map((s) => [String(s.id), normalizeRuleDealTypes(s.deal_types)])
        )
        for (const r of rows) {
          if (byId.has(r.id)) r.dealTypes = byId.get(r.id) ?? []
        }
      }
    }
    return { ok: true, rules: rows }
  } catch {
    return { ok: false, error: "We couldn't load your rules. Please try again." }
  }
}

export async function addStandingRule(input: string, dealTypes: string[] = []): Promise<AddRuleResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const text = input.trim().slice(0, MAX_RULE_CHARS)
  if (!text) return { ok: false, error: "Write the rule first." }
  const scope = normalizeRuleDealTypes(dealTypes)
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
    // Scoped writes need migration 00089; unscoped writes omit the column so
    // they keep working before it is applied.
    const { data, error } = await supabase
      .from("standing_instructions")
      .insert({ user_id: user.id, text, ...(scope.length > 0 ? { deal_types: scope } : {}) })
      .select("id, text, created_at")
      .single()
    if (error || !data) {
      if (scope.length > 0 && isMissingScopeColumn(error)) {
        return { ok: false, error: "Rule scopes need a database update (migration 00089). Save without a scope for now." }
      }
      return { ok: false, error: "We couldn't save your rule. Please try again." }
    }
    const rule = toStandingRule(data)
    if (!rule) return { ok: false, error: "We couldn't save your rule. Please try again." }
    rule.dealTypes = scope
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
// on any failure: missing rules must never break an answer. Pass the deal
// type to honor per-type scopes; unknown deals receive every rule rather
// than silently dropping scoped ones.
export async function getStandingRuleTexts(dealType?: string | null): Promise<string[]> {
  try {
    const listed = await listStandingRules()
    if (!listed.ok) return []
    return listed.rules
      .filter((r) => ruleAppliesToDeal(r.dealTypes, dealType ?? null))
      .map((r) => r.text.trim())
      .filter((t) => t.length > 0)
  } catch {
    return []
  }
}
