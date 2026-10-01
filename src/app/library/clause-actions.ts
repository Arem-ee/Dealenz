"use server"

import { createClient } from "@/lib/supabase/server"
import {
  deriveClauseTracking,
  familyForDocumentType,
  type ClauseTrackingAudit,
  type ClauseTrackingVersion,
  type DealClauseState,
} from "@/lib/clauses/tracking"

const MAX_CLAUSE_DEALS = 100

export type ClauseTrackingResult =
  | { ok: true; deals: DealClauseState[] }
  | { ok: false; error: string }

interface AuditRow {
  id: string
  title: string | null
  deal_type: string | null
  structured_data: { deterministicFindings?: unknown } | null
  updated_at: string
}

interface VersionRow {
  id: string
  audit_id: string
  document_type: string
  version_number: number
  status: string | null
  created_at: string
}

/**
 * Clause tracking across the user's deals. Read-only over already-persisted
 * audits and document versions — no new tables. Findings without evidence
 * stay suggestions; only locked versions count as signed.
 */
export async function getClauseTracking(): Promise<ClauseTrackingResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }

  const { data: auditRows, error: auditError } = await supabase
    .from("audits")
    .select("id, title, deal_type, structured_data, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(MAX_CLAUSE_DEALS)
  if (auditError || !auditRows) {
    return { ok: false, error: "We couldn't load your clauses. Please try again." }
  }
  const audits = auditRows as unknown as AuditRow[]
  if (audits.length === 0) return { ok: true, deals: [] }

  const auditIds = audits.map((a) => a.id)
  const { data: versionRows, error: versionError } = await supabase
    .from("document_versions")
    .select("id, audit_id, document_type, version_number, status, created_at")
    .eq("user_id", user.id)
    .in("audit_id", auditIds)
    .order("version_number", { ascending: false })
  if (versionError || !versionRows) {
    return { ok: false, error: "We couldn't load your clauses. Please try again." }
  }
  const versions = versionRows as unknown as VersionRow[]

  // Latest version id per (audit, family) — content is fetched only for
  // these, so large draft histories never leave the database.
  const latestIds = new Set<string>()
  const seen = new Set<string>()
  for (const v of versions) {
    if (!familyForDocumentType(v.document_type)) continue
    const key = `${v.audit_id}:${v.document_type}`
    if (seen.has(key)) continue
    seen.add(key)
    latestIds.add(v.id)
  }
  const contentById = new Map<string, string>()
  if (latestIds.size > 0) {
    const { data: contentRows } = await supabase
      .from("document_versions")
      .select("id, content")
      .eq("user_id", user.id)
      .in("id", [...latestIds])
    for (const r of (contentRows ?? []) as Array<{ id: string; content: string | null }>) {
      if (typeof r.content === "string") contentById.set(r.id, r.content)
    }
  }

  const trackingAudits: ClauseTrackingAudit[] = audits.map((a) => {
    const raw = a.structured_data?.deterministicFindings
    return {
      id: a.id,
      title: a.title?.trim() ? a.title : "Untitled",
      dealType: a.deal_type ?? "generic",
      updatedAt: a.updated_at,
      findings: Array.isArray(raw) ? raw as ClauseTrackingAudit["findings"] : [],
    }
  })
  const trackingVersions: ClauseTrackingVersion[] = versions.map((v) => ({
    id: v.id,
    auditId: v.audit_id,
    documentType: v.document_type,
    versionNumber: v.version_number,
    status: v.status,
    createdAt: v.created_at,
    content: contentById.get(v.id) ?? null,
  }))

  return { ok: true, deals: deriveClauseTracking(trackingAudits, trackingVersions) }
}
