"use server"

import { createClient } from "@/lib/supabase/server"
import { isLocale, LOCALE_META } from "@/lib/i18n/locale"
import { normalizeRuleDealTypes } from "@/lib/standing/rules"

export interface ContentHit {
  dealId: string
  threadId: string | null
  title: string
  dealType: string | null
  kind: "title" | "content" | "clause"
  snippet: string | null
  rank: number
}

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

/**
 * Exhaustive content search (the Search half of the market's split; Ask
 * stays the representative-answers surface). Runs the RLS-scoped
 * search_deals RPC — owner + shared rows only, enforced by table policies,
 * never by app filters. Snippets quote matched text; the UI labels
 * approximations as approximations.
 */
export async function searchContent(input: {
  query: string
  dealTypes?: string[]
}): Promise<ActionOk<{ hits: ContentHit[] }> | ActionFail> {
  const query = typeof input.query === "string" ? input.query.trim().slice(0, 200) : ""
  if (query.length < 2) return { ok: true, hits: [] }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const dealTypes = normalizeRuleDealTypes(input.dealTypes).filter((t) => t !== "generic")
  // Query language follows the profile locale (best-effort, English gap):
  // french/german stemming on same-language columns, English columns
  // always matched too, so recall never cliffs across languages.
  let language = "english"
  try {
    const { data: profile } = await supabase
      .from("business_profiles")
      .select("locale")
      .eq("user_id", user.id)
      .maybeSingle()
    const stored = (profile as { locale?: unknown } | null)?.locale
    if (isLocale(stored)) language = LOCALE_META[stored].searchConfig
  } catch {
    language = "english"
  }
  const { data, error } = await supabase.rpc("search_deals", {
    p_query: query,
    p_deal_types: dealTypes.length > 0 ? dealTypes : null,
    p_limit: 20,
    p_language: language,
  })
  if (error) {
    if (error.message.includes("search_deals") || error.message.includes("content_tsv")) {
      return { ok: false, error: "Search needs a database update (migration 00115). Please try again after migrating." }
    }
    return { ok: false, error: "Search failed — please try again." }
  }
  const rows = (data ?? []) as Array<{
    deal_id: string; title: string | null; deal_type: string | null;
    kind: string; snippet: string | null; rank: number
  }>
  const ids = [...new Set(rows.map((r) => r.deal_id))]
  const threadByAudit = new Map<string, string>()
  if (ids.length > 0) {
    const { data: threads } = await supabase
      .from("conversations")
      .select("id, attached_audit_id")
      .in("attached_audit_id", ids)
      .limit(60)
    for (const t of ((threads ?? []) as Array<{ id: string; attached_audit_id: string | null }>)) {
      if (t.attached_audit_id && !threadByAudit.has(t.attached_audit_id)) {
        threadByAudit.set(t.attached_audit_id, t.id)
      }
    }
  }
  // No user_id filter: the shared-read policy on conversations exposes
  // shared threads, so shared deals resolve to their threads too.
  const hits: ContentHit[] = []
  for (const r of rows) {
    if (r.kind !== "title" && r.kind !== "content" && r.kind !== "clause") continue
    hits.push({
      dealId: r.deal_id,
      threadId: threadByAudit.get(r.deal_id) ?? null,
      title: r.title?.trim() ? r.title : "Untitled",
      dealType: r.deal_type,
      kind: r.kind,
      snippet: r.snippet,
      rank: r.rank,
    })
  }
  return { ok: true, hits }
}
