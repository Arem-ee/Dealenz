"use server"

import { createClient } from "@/lib/supabase/server"
import { familyById } from "@/lib/documents/families"
import { diffLines, type DiffLine } from "@/lib/diff/lines"
import { summarizeDiff, type DiffSummary } from "@/lib/diff/summary"
import { diffFindingSets, type FindingDelta } from "@/lib/rules/result"

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

export interface ComparableDoc {
  id: string
  dealTitle: string
  familyTitle: string
  versionNumber: number
  status: string | null
  createdAt: string
}

/** User's generated versions, newest first, for the Compare pickers. */
export async function listComparables(): Promise<ActionOk<{ docs: ComparableDoc[] }> | ActionFail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }

  const { data: versions, error } = await supabase
    .from("document_versions")
    .select("id, audit_id, document_type, version_number, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200)
  if (error || !versions) return { ok: false, error: "We couldn't load your documents. Please try again." }

  const rows = versions as Array<{
    id: string; audit_id: string; document_type: string; version_number: number; status: string | null; created_at: string
  }>
  const titles = new Map<string, string>()
  const auditIds = [...new Set(rows.map((v) => v.audit_id))]
  if (auditIds.length > 0) {
    const { data: audits } = await supabase.from("audits").select("id, title").eq("user_id", user.id).in("id", auditIds)
    for (const a of ((audits ?? []) as Array<{ id: string; title: string | null }>)) {
      titles.set(a.id, a.title?.trim() ? a.title : "Untitled")
    }
  }
  return {
    ok: true,
    docs: rows.map((v) => ({
      id: v.id,
      dealTitle: titles.get(v.audit_id) ?? "Untitled",
      familyTitle: familyById(v.document_type)?.title ?? v.document_type,
      versionNumber: v.version_number,
      status: v.status,
      createdAt: v.created_at,
    })),
  }
}

export interface CompareSide extends ComparableDoc {
  auditId: string
}

export interface CompareResult {
  left: CompareSide
  right: CompareSide
  lines: DiffLine[]
  summary: DiffSummary
  findingDelta: FindingDelta | null
}

/**
 * Line-level diff of two owned versions plus a material-difference summary.
 * Finding delta treats the left document's deal findings as baseline and the
 * right's as current (resolved / still open / new).
 */
export async function compareVersions(input: {
  leftId: string
  rightId: string
}): Promise<ActionOk<CompareResult> | ActionFail> {
  const leftId = (input.leftId ?? "").trim()
  const rightId = (input.rightId ?? "").trim()
  if (!leftId || !rightId) return { ok: false, error: "Pick two documents." }
  if (leftId === rightId) return { ok: false, error: "Pick two different documents." }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }

  const { data: versions, error } = await supabase
    .from("document_versions")
    .select("id, audit_id, document_type, version_number, status, content, created_at")
    .eq("user_id", user.id)
    .in("id", [leftId, rightId])
  if (error || !versions) return { ok: false, error: "We couldn't load those documents. Please try again." }
  const rows = versions as Array<{
    id: string; audit_id: string; document_type: string; version_number: number;
    status: string | null; content: string | null; created_at: string
  }>
  const left = rows.find((r) => r.id === leftId)
  const right = rows.find((r) => r.id === rightId)
  if (!left || !right) return { ok: false, error: "Document not found." }

  const lines = diffLines(left.content ?? "", right.content ?? "")
  if (!lines) return { ok: false, error: "Documents too large to compare." }
  const summary = summarizeDiff(lines)

  let findingDelta: FindingDelta | null = null
  try {
    const { data: audits } = await supabase
      .from("audits")
      .select("id, structured_data")
      .eq("user_id", user.id)
      .in("id", [left.audit_id, right.audit_id])
    const byId = new Map(
      ((audits ?? []) as Array<{ id: string; structured_data: { deterministicFindings?: unknown } | null }>).map((a) => [a.id, a.structured_data?.deterministicFindings])
    )
    // Baseline = left deal findings, current = right deal findings.
    const currentRaw = byId.get(right.audit_id)
    findingDelta = diffFindingSets(byId.get(left.audit_id), (Array.isArray(currentRaw) ? currentRaw : []) as never)
  } catch {
    findingDelta = null
  }

  const titles = new Map<string, string>()
  try {
    const { data: titleRows } = await supabase
      .from("audits")
      .select("id, title")
      .eq("user_id", user.id)
      .in("id", [left.audit_id, right.audit_id])
    for (const a of ((titleRows ?? []) as Array<{ id: string; title: string | null }>)) {
      titles.set(a.id, a.title?.trim() ? a.title : "Untitled")
    }
  } catch {
    // Titles stay fallback.
  }

  const side = (r: typeof left): CompareSide => ({
    id: r.id,
    auditId: r.audit_id,
    dealTitle: titles.get(r.audit_id) ?? "Untitled",
    familyTitle: familyById(r.document_type)?.title ?? r.document_type,
    versionNumber: r.version_number,
    status: r.status,
    createdAt: r.created_at,
  })

  return { ok: true, left: side(left), right: side(right), lines, summary, findingDelta }
}
