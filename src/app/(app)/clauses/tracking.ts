"use server"

import { createClient } from "@/lib/supabase/server"
import { clauseById } from "@/lib/protection/clauses"
import {
  deriveClauseTracking,
  type ClauseTrackingAudit,
  type ClauseTrackingVersion,
  type DealClauseState,
  type TrackedClause,
} from "@/lib/clauses/tracking"
import { isClauseUserState, type ClauseUserState } from "@/lib/library/entries"
import type { RuleResult } from "@/lib/rules/result"

export interface TrackedClauseWithUser extends TrackedClause {
  userState: ClauseUserState | null
  userNote: string
}

export interface DealClauseStateWithUser extends Omit<DealClauseState, "clauses"> {
  clauses: TrackedClauseWithUser[]
}

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

/**
 * Per-deal clause tracking: the derived read-model (provable from versions
 * and findings) overlaid with the user's stored actions. Stored states
 * annotate — they never rewrite derived truth.
 */
export async function getTrackedDeals(): Promise<ActionOk<{ deals: DealClauseStateWithUser[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }

  const { data: audits, error: auditError } = await supabase
    .from("audits")
    .select("id, title, deal_type, updated_at, structured_data")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100)
  if (auditError) return { ok: false, error: "We couldn't load tracking. Please try again." }
  const auditRows = (audits ?? []) as Array<{
    id: string; title: string | null; deal_type: string | null; updated_at: string;
    structured_data: { deterministicFindings?: unknown } | null
  }>
  if (auditRows.length === 0) return { ok: true, deals: [] }

  const trackingAudits: ClauseTrackingAudit[] = auditRows.map((a) => ({
    id: a.id,
    title: a.title?.trim() ? a.title : "Untitled",
    dealType: a.deal_type ?? "generic",
    updatedAt: a.updated_at,
    findings: (Array.isArray(a.structured_data?.deterministicFindings)
      ? a.structured_data.deterministicFindings
      : []) as RuleResult[],
  }))

  const auditIds = auditRows.map((a) => a.id)
  const { data: versions } = await supabase
    .from("document_versions")
    .select("id, audit_id, document_type, version_number, status, created_at")
    .eq("user_id", user.id)
    .in("audit_id", auditIds)
    .order("version_number", { ascending: true })
    .limit(500)
  const versionRows = (versions ?? []) as Array<{
    id: string; audit_id: string; document_type: string; version_number: number; status: string | null; created_at: string
  }>

  // Content is needed only for the latest version per (deal, family) to
  // detect unresolved {{variables}} — one bounded fetch, not the full table.
  const latestIds = new Set<string>()
  {
    const seen = new Map<string, { id: string; n: number }>()
    for (const v of versionRows) {
      const k = `${v.audit_id}:${v.document_type}`
      const cur = seen.get(k)
      if (!cur || v.version_number > cur.n) seen.set(k, { id: v.id, n: v.version_number })
    }
    for (const { id } of seen.values()) latestIds.add(id)
  }
  const contentById = new Map<string, string | null>()
  if (latestIds.size > 0) {
    const { data: contents } = await supabase
      .from("document_versions")
      .select("id, content")
      .eq("user_id", user.id)
      .in("id", [...latestIds])
    for (const c of ((contents ?? []) as Array<{ id: string; content: string | null }>)) {
      contentById.set(c.id, c.content)
    }
  }
  const trackingVersions: ClauseTrackingVersion[] = versionRows.map((v) => ({
    id: v.id,
    auditId: v.audit_id,
    documentType: v.document_type,
    versionNumber: v.version_number,
    status: v.status,
    createdAt: v.created_at,
    content: contentById.get(v.id) ?? null,
  }))

  const { data: states } = await supabase
    .from("clause_states")
    .select("audit_id, clause_id, status, note")
    .eq("user_id", user.id)
    .in("audit_id", auditIds)
  const stored = new Map<string, { status: ClauseUserState; note: string }>()
  for (const s of ((states ?? []) as Array<{ audit_id: string; clause_id: string; status: unknown; note: unknown }>)) {
    if (!isClauseUserState(s.status)) continue
    stored.set(`${s.audit_id}:${s.clause_id}`, {
      status: s.status,
      note: typeof s.note === "string" ? s.note : "",
    })
  }

  const deals = deriveClauseTracking(trackingAudits, trackingVersions).map((d) => ({
    ...d,
    clauses: d.clauses.map((c) => {
      const hit = stored.get(`${d.auditId}:${c.clauseId}`)
      return { ...c, userState: hit?.status ?? null, userNote: hit?.note ?? "" }
    }),
  }))
  return { ok: true, deals }
}

/**
 * Records a user action on a tracked clause (accept / edit / dismiss).
 * The clause must appear in the deal's derived tracking — actions attach
 * to provable clauses, never to invented ids.
 */
export async function setClauseState(input: {
  auditId: string
  clauseId: string
  status: ClauseUserState
  note?: string
}): Promise<ActionOk<{ status: ClauseUserState }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  if (!isClauseUserState(input.status)) return { ok: false, error: "Unknown clause action." }
  const auditId = (input.auditId ?? "").trim()
  const clauseId = (input.clauseId ?? "").trim()
  if (!auditId || !clauseId) return { ok: false, error: "That clause no longer exists." }
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : ""
  if (input.status === "edited" && !note) {
    return { ok: false, error: "Add a note describing the edit." }
  }

  const { data: audit } = await supabase
    .from("audits")
    .select("id, title, deal_type, updated_at, structured_data")
    .eq("id", auditId)
    .eq("user_id", user.id)
    .maybeSingle()
  const auditRow = audit as {
    id: string; title: string | null; deal_type: string | null; updated_at: string;
    structured_data: { deterministicFindings?: unknown } | null
  } | null
  if (!auditRow) return { ok: false, error: "Deal not found." }

  const { data: versions } = await supabase
    .from("document_versions")
    .select("id, audit_id, document_type, version_number, status, content, created_at")
    .eq("user_id", user.id)
    .eq("audit_id", auditId)
    .limit(200)
  const derived = deriveClauseTracking(
    [{
      id: auditRow.id,
      title: auditRow.title ?? "Untitled",
      dealType: auditRow.deal_type ?? "generic",
      updatedAt: auditRow.updated_at,
      findings: (Array.isArray(auditRow.structured_data?.deterministicFindings)
        ? auditRow.structured_data.deterministicFindings
        : []) as RuleResult[],
    }],
    ((versions ?? []) as Array<{
      id: string; audit_id: string; document_type: string; version_number: number;
      status: string | null; content: string | null; created_at: string
    }>).map((v) => ({
      id: v.id, auditId: v.audit_id, documentType: v.document_type,
      versionNumber: v.version_number, status: v.status, createdAt: v.created_at, content: v.content,
    }))
  )
  const known = derived[0]?.clauses.some((c) => c.clauseId === clauseId) ?? false
  if (!known && !clauseById(clauseId)) return { ok: false, error: "That clause no longer exists." }

  const { error } = await supabase.from("clause_states").upsert(
    { user_id: user.id, audit_id: auditId, clause_id: clauseId, status: input.status, note, updated_at: new Date().toISOString() },
    { onConflict: "user_id,audit_id,clause_id" }
  )
  if (error) return { ok: false, error: "We couldn't save that. Please try again." }
  return { ok: true, status: input.status }
}

/** Reverts a clause to its derived state by removing the stored action. */
export async function clearClauseState(input: {
  auditId: string
  clauseId: string
}): Promise<ActionOk<{ cleared: boolean }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { error } = await supabase
    .from("clause_states")
    .delete()
    .eq("user_id", user.id)
    .eq("audit_id", (input.auditId ?? "").trim())
    .eq("clause_id", (input.clauseId ?? "").trim())
  if (error) return { ok: false, error: "We couldn't clear that. Please try again." }
  return { ok: true, cleared: true }
}
