"use server"

import { createClient } from "@/lib/supabase/server"
import { reportError } from "@/lib/logger"
import { familyById } from "@/lib/documents/families"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireOwnerAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  auditId: string
) {
  if (!UUID_RE.test(auditId)) throw new Error("Invalid audit ID")
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !UUID_RE.test(user.id)) throw new Error("Unauthorized")
  const { data: audit } = await supabase
    .from("audits")
    .select("id, status")
    .eq("id", auditId)
    .eq("user_id", user.id)
    .single()
  if (!audit) throw new Error("Audit not found")
  return { user, audit: audit as { id: string; status: string } }
}

async function logDealActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  auditId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from("activity_events").insert({
      user_id: userId,
      audit_id: auditId,
      event_type: eventType,
      payload,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Audit trail is best-effort; never breaks the transition.
  }
}

interface SignerRow {
  status: string
}

/** True when a final version's signing is complete: ≥1 bound signer, none pending. */
// Async (rather than a sync predicate) because "use server" modules may only
// export async functions; the rule itself is pure and synchronous.
export async function isVersionExecuted(signers: SignerRow[]): Promise<boolean> {
  return signers.length > 0 && signers.every((s) => s.status === "signed")
}

/**
 * Mark one document version as the explicit final for its type.
 *
 * Server-controlled rules (no client "final = true"):
 * - version exists and belongs to this deal and type
 * - version is the latest for its type (no superseding revision exists)
 * - an already-executed final cannot be re-pointed (new versions after
 *   execution stay ordinary versions; history is never rewritten)
 * Re-pointing an unexecuted final to a newer version is allowed and honest:
 * the pointer moves, history stays.
 */
export async function finalizeDocument(auditId: string, versionId: string) {
  const supabase = await createClient()
  const { user } = await requireOwnerAudit(supabase, auditId)
  if (!UUID_RE.test(versionId)) throw new Error("Invalid document version")

  const { data: version } = await supabase
    .from("document_versions")
    .select("id, audit_id, document_type, version_number")
    .eq("id", versionId)
    .eq("audit_id", auditId)
    .maybeSingle<{ id: string; audit_id: string; document_type: string; version_number: number }>()
  if (!version) throw new Error("Document version does not belong to this deal")

  const { data: latest } = await supabase
    .from("document_versions")
    .select("version_number")
    .eq("audit_id", auditId)
    .eq("document_type", version.document_type)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ version_number: number }>()
  if (latest && latest.version_number !== version.version_number) {
    throw new Error("A newer version exists; finalize the latest version instead")
  }

  const { data: current } = await supabase
    .from("final_documents")
    .select("document_version_id")
    .eq("audit_id", auditId)
    .eq("document_type", version.document_type)
    .maybeSingle<{ document_version_id: string }>()
  if (current && current.document_version_id === version.id) {
    return { success: true, final: true }
  }
  if (current) {
    // An executed final is locked: new versions after execution never disturb it.
    const { data: bound } = await supabase
      .from("document_signers")
      .select("status")
      .eq("audit_id", auditId)
      .eq("document_type", version.document_type)
      .eq("document_version_id", current.document_version_id)
    const rows = ((bound ?? []) as SignerRow[])
    if (await isVersionExecuted(rows)) {
      throw new Error("This document is already executed; new versions cannot replace the executed final")
    }
    const { error } = await supabase
      .from("final_documents")
      .update({ document_version_id: version.id, finalized_at: new Date().toISOString() })
      .eq("audit_id", auditId)
      .eq("document_type", version.document_type)
    if (error) throw new Error(`Failed to finalize document: ${error.message}`)
  } else {
    const { error } = await supabase.from("final_documents").insert({
      audit_id: auditId,
      document_type: version.document_type,
      document_version_id: version.id,
    })
    if (error) throw new Error(`Failed to finalize document: ${error.message}`)
  }

  await logDealActivity(supabase, user.id, auditId, "document_finalized", {
    document_type: version.document_type,
    document_version_id: version.id,
    version_number: version.version_number,
  })
  return { success: true, final: true }
}

export interface FinalDocumentView {
  id: string
  documentType: string
  documentVersionId: string
  finalizedAt: string
  title: string
  versionNumber: number
  content: string
  signers: Array<{
    id: string
    name: string
    email: string
    partyLabel: string
    status: string
    signedAt: string | null
  }>
  executed: boolean
}

export interface VersionListItem {
  id: string
  documentType: string
  versionNumber: number
  createdAt: string
}

/** Finals with their version content, bound signers, and derived execution. */
export async function getFinalDocuments(
  auditId: string
): Promise<{ success: true; finals: FinalDocumentView[]; versions: VersionListItem[] }> {
  const supabase = await createClient()
  await requireOwnerAudit(supabase, auditId)

  const { data: finals } = await supabase
    .from("final_documents")
    .select("id, document_type, document_version_id, finalized_at")
    .eq("audit_id", auditId)
    .order("finalized_at", { ascending: true })
  const rows = ((finals ?? []) as Array<{
    id: string
    document_type: string
    document_version_id: string
    finalized_at: string
  }>)

  const { data: versionRows } = await supabase
    .from("document_versions")
    .select("id, document_type, version_number, created_at")
    .eq("audit_id", auditId)
    .order("version_number", { ascending: false })
    .limit(100)
  const versions: VersionListItem[] = ((versionRows ?? []) as Array<{
    id: string
    document_type: string
    version_number: number
    created_at: string
  }>).map((v) => ({
    id: String(v.id),
    documentType: String(v.document_type),
    versionNumber: typeof v.version_number === "number" ? v.version_number : 0,
    createdAt: String(v.created_at ?? ""),
  }))

  const result: FinalDocumentView[] = []
  for (const f of rows) {
    const [{ data: version }, { data: signers }] = await Promise.all([
      supabase
        .from("document_versions")
        .select("id, document_type, version_number, content, generation_method, created_at")
        .eq("id", f.document_version_id)
        .maybeSingle(),
      supabase
        .from("document_signers")
        .select("id, name, email, party_label, status, signed_at")
        .eq("audit_id", auditId)
        .eq("document_type", f.document_type)
        .eq("document_version_id", f.document_version_id)
        .order("created_at", { ascending: true }),
    ])
    const v = (version ?? {}) as { version_number?: number; content?: string }
    const signerRows = ((signers ?? []) as Array<{
      id: string
      name: string
      email: string
      party_label: string
      status: string
      signed_at: string | null
    }>)
    result.push({
      id: f.id,
      documentType: f.document_type,
      documentVersionId: f.document_version_id,
      finalizedAt: f.finalized_at,
      title: familyById(f.document_type)?.title ?? f.document_type,
      versionNumber: v.version_number ?? 0,
      content: typeof v.content === "string" ? v.content : "",
      signers: signerRows.map((s) => ({
        id: String(s.id),
        name: String(s.name),
        email: String(s.email ?? ""),
        partyLabel: String(s.party_label ?? "signer"),
        status: String(s.status),
        signedAt: typeof s.signed_at === "string" ? s.signed_at : null,
      })),
      executed: await isVersionExecuted(signerRows),
    })
  }
  return { success: true, finals: result, versions }
}

/**
 * Complete a deal. Derived, never declared: requires at least one final
 * document, and every final version with outstanding (pending) signers
 * blocks completion. Declined/revoked signers resolved out via re-invitation
 * and do not block. Completed deals have no reopen path by design.
 */
export async function completeDeal(auditId: string) {
  const supabase = await createClient()
  const { user, audit } = await requireOwnerAudit(supabase, auditId)
  if (audit.status === "completed") return { success: true, status: "completed" }

  const { data: finals } = await supabase
    .from("final_documents")
    .select("document_type, document_version_id")
    .eq("audit_id", auditId)
  const rows = ((finals ?? []) as Array<{ document_type: string; document_version_id: string }>)
  if (rows.length === 0) {
    throw new Error("Finalize at least one document before completing the deal")
  }

  const blocking: string[] = []
  for (const f of rows) {
    const { data: signers } = await supabase
      .from("document_signers")
      .select("status")
      .eq("audit_id", auditId)
      .eq("document_type", f.document_type)
      .eq("document_version_id", f.document_version_id)
    const pending = ((signers ?? []) as SignerRow[]).filter((s) => s.status === "pending").length
    if (pending > 0) blocking.push(`${f.document_type} (${pending} signature${pending === 1 ? "" : "s"} pending)`)
  }
  if (blocking.length > 0) {
    throw new Error(`Signing incomplete: ${blocking.join("; ")}`)
  }

  const { error } = await supabase
    .from("audits")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", auditId)
    .eq("user_id", user.id)
  if (error) {
    await reportError(supabase, {
      phase: "deal_complete",
      error,
      details: { step: "status_update" },
      severity: "error",
      userId: user.id,
      auditId,
    })
    throw new Error(`Failed to complete deal: ${error.message}`)
  }
  await logDealActivity(supabase, user.id, auditId, "deal_completed", {
    finals: rows.map((f) => f.document_type),
  })
  return { success: true, status: "completed" }
}
