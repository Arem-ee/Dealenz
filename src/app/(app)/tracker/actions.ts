"use server"

import { createClient } from "@/lib/supabase/server"

// Tracker keeper: one read across everything the product watches —
// extracted obligations (monitoring_events), signing deadlines (invites
// with expiry), and cross-contract conflicts (persisted per deal at
// analysis time). No new tables: the keeper only aggregates. Mutations
// reuse the monitoring actions (resolve, watch, alert).

export interface KeeperObligation {
  id: string
  auditId: string
  dealTitle: string
  threadId: string | null
  eventType: string
  title: string
  dueDate: string | null
  provenance: string
  status: string
  source: string
}

export interface KeeperDeadline {
  signerId: string
  dealTitle: string
  signerName: string
  signerEmail: string
  expiresAt: string
  status: "pending" | "expired"
  link: string
  versionId: string
}

export interface KeeperConflictItem {
  type: string
  message: string
  auditTitle: string
  clauseTitle: string
}

export interface KeeperConflict {
  auditId: string
  dealTitle: string
  threadId: string | null
  conflicts: KeeperConflictItem[]
}

type KeeperOk = {
  ok: true
  obligations: KeeperObligation[]
  deadlines: KeeperDeadline[]
  conflicts: KeeperConflict[]
}
type KeeperFail = { ok: false; error: string }

function isConflict(value: unknown): value is KeeperConflictItem {
  if (typeof value !== "object" || value === null) return false
  const c = value as Record<string, unknown>
  return typeof c.message === "string" && typeof c.auditTitle === "string" && typeof c.clauseTitle === "string"
}

export async function listKeeper(): Promise<KeeperOk | KeeperFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const userId = user.id

  const { data: eventRows, error: eventError } = await supabase
    .from("monitoring_events")
    .select("id, audit_id, event_type, title, due_date, provenance, status, source")
    .eq("user_id", userId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200)
  if (eventError) return { ok: false, error: "We couldn't load tracking. Please try again." }

  const { data: signerRows, error: signerError } = await supabase
    .from("document_signers")
    .select("id, name, email, token, status, expires_at, document_version_id")
    .not("expires_at", "is", null)
    .in("status", ["pending", "expired"])
    .order("expires_at", { ascending: true })
    .limit(200)
  if (signerError) return { ok: false, error: "We couldn't load tracking. Please try again." }

  const { data: auditRows, error: auditError } = await supabase
    .from("audits")
    .select("id, title, structured_data")
    .eq("user_id", userId)
    .limit(100)
  if (auditError) return { ok: false, error: "We couldn't load tracking. Please try again." }

  const titles = new Map<string, string>()
  for (const a of ((auditRows ?? []) as Array<{ id: string; title: string | null }>)) {
    titles.set(a.id, a.title?.trim() ? a.title : "Untitled")
  }

  // Newest thread per deal, for "open in workspace" navigation.
  const threads = new Map<string, string>()
  const auditIds = [...titles.keys()]
  if (auditIds.length > 0) {
    const { data: convos } = await supabase
      .from("conversations")
      .select("id, attached_audit_id")
      .eq("user_id", userId)
      .in("attached_audit_id", auditIds)
      .order("created_at", { ascending: false })
      .limit(200)
    for (const c of ((convos ?? []) as Array<{ id: string; attached_audit_id: string | null }>)) {
      if (c.attached_audit_id && !threads.has(c.attached_audit_id)) threads.set(c.attached_audit_id, c.id)
    }
  }

  const versionIds = [...new Set(
    ((signerRows ?? []) as Array<{ document_version_id: string }>)
      .map((r) => r.document_version_id)
      .filter(Boolean)
  )]
  if (versionIds.length > 0) {
    const { data: versions } = await supabase
      .from("document_versions")
      .select("id, audit_id")
      .eq("user_id", userId)
      .in("id", versionIds)
    for (const v of ((versions ?? []) as Array<{ id: string; audit_id: string }>)) {
      titles.set(`version:${v.id}`, titles.get(v.audit_id) ?? "Untitled")
    }
  }

  const obligations: KeeperObligation[] = ((eventRows ?? []) as Array<{
    id: string; audit_id: string; event_type: string; title: string;
    due_date: string | null; provenance: string; status: string; source: string;
  }>).map((e) => ({
    id: e.id,
    auditId: e.audit_id,
    dealTitle: titles.get(e.audit_id) ?? "Untitled",
    threadId: threads.get(e.audit_id) ?? null,
    eventType: e.event_type,
    title: e.title,
    dueDate: e.due_date,
    provenance: e.provenance,
    status: e.status,
    source: e.source,
  }))

  const deadlines: KeeperDeadline[] = ((signerRows ?? []) as Array<{
    id: string; name: string; email: string; token: string;
    status: string; expires_at: string | null; document_version_id: string;
  }>)
    .filter((s) => s.expires_at && (s.status === "pending" || s.status === "expired"))
    .map((s) => ({
      signerId: s.id,
      dealTitle: titles.get(`version:${s.document_version_id}`) ?? "Untitled",
      signerName: s.name,
      signerEmail: s.email,
      expiresAt: s.expires_at as string,
      status: s.status as "pending" | "expired",
      link: `/sign/${(s as { token: string }).token}`,
      versionId: s.document_version_id,
    }))

  const conflicts: KeeperConflict[] = []
  for (const a of ((auditRows ?? []) as Array<{ id: string; title: string | null; structured_data: unknown }>)) {
    const sd = (a.structured_data ?? {}) as Record<string, unknown>
    const raw = Array.isArray(sd.corpusConflicts) ? sd.corpusConflicts : []
    const items = (raw as unknown[]).filter(isConflict)
    if (items.length === 0) continue
    conflicts.push({
      auditId: a.id,
      dealTitle: titles.get(a.id) ?? "Untitled",
      threadId: threads.get(a.id) ?? null,
      conflicts: items.map((c) => ({ type: typeof (c as { type?: unknown }).type === "string" ? (c as { type: string }).type : "conflict", message: c.message, auditTitle: c.auditTitle, clauseTitle: c.clauseTitle })),
    })
  }

  return { ok: true, obligations, deadlines, conflicts }
}

/** Deals available as carriers for user-created watches. */
export async function listWatchedDeals(): Promise<
  { ok: true; deals: Array<{ id: string; title: string }> } | KeeperFail
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data, error } = await supabase
    .from("audits")
    .select("id, title")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50)
  if (error) return { ok: false, error: "We couldn't load deals. Please try again." }
  return {
    ok: true,
    deals: ((data ?? []) as Array<{ id: string; title: string | null }>).map((a) => ({
      id: a.id,
      title: a.title?.trim() ? a.title : "Untitled",
    })),
  }
}
