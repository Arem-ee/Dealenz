// Signing store helpers (Phase 3) — server-side, RLS-scoped, idempotent
// Uses Supabase client with auth.uid() = user_id. No service_role bypass.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { SigningStatus } from "./transitions"
import { canTransitionSigning } from "./transitions"

type Client = SupabaseClient

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export interface DocumentVersionRow {
  id: string
  audit_id: string
  user_id: string
  document_type: string
  version_number: number
  content: string
  generation_method: string
  parent_version_id: string | null
  content_hash: string | null
  provenance: Record<string, unknown>
  status: SigningStatus
  work_product_id: string | null
  owner_signed_at: string | null
  counterparty_signed_at: string | null
  fully_signed_at: string | null
  locked_at: string | null
  signing_provenance: Record<string, unknown>
  created_at: string
  updated_at: string
}

export async function getDocumentVersion(client: Client, userId: string, versionId: string): Promise<DocumentVersionRow | null> {
  if (!isUUID(versionId) || !isUUID(userId)) return null
  const { data, error } = await client.from("document_versions").select("*").eq("id", versionId).eq("user_id", userId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as DocumentVersionRow | null) ?? null
}

export async function listDocumentVersions(client: Client, userId: string, auditId: string): Promise<DocumentVersionRow[]> {
  if (!isUUID(auditId)) throw new Error("Invalid auditId")
  const { data, error } = await client.from("document_versions").select("*").eq("audit_id", auditId).eq("user_id", userId).order("version_number", { ascending: true })
  if (error) throw new Error(error.message)
  return (data as DocumentVersionRow[]) ?? []
}

export async function createSigningReadyVersion(
  client: Client,
  userId: string,
  input: { auditId: string; documentType: string; content: string; generationMethod?: string; parentVersionId?: string | null; provenance?: Record<string, unknown> }
): Promise<DocumentVersionRow> {
  if (!isUUID(input.auditId)) throw new Error("Invalid auditId")
  const hash = `hash_${input.content.length}_${Date.now().toString(36)}`
  const { data, error } = await client
    .from("document_versions")
    .insert({
      audit_id: input.auditId,
      user_id: userId,
      document_type: input.documentType,
      content: input.content,
      generation_method: input.generationMethod ?? "assembled",
      parent_version_id: input.parentVersionId ?? null,
      content_hash: hash,
      provenance: input.provenance ?? {},
      status: "draft",
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed to create version")
  return data as DocumentVersionRow
}

export async function transitionSigningStatus(
  client: Client,
  userId: string,
  versionId: string,
  to: SigningStatus,
  provenance?: Record<string, unknown>
): Promise<DocumentVersionRow> {
  const current = await getDocumentVersion(client, userId, versionId)
  if (!current) throw new Error("Version not found")
  if (!canTransitionSigning(current.status as SigningStatus, to)) throw new Error(`Invalid signing transition ${current.status} -> ${to}`)
  const updates: Record<string, unknown> = { status: to, updated_at: new Date().toISOString(), signing_provenance: { ...(current.signing_provenance ?? {}), ...(provenance ?? {}), transition: `${current.status}->${to}`, at: new Date().toISOString() } }
  if (to === "owner_signed") updates.owner_signed_at = new Date().toISOString()
  if (to === "counterparty_pending" || to === "sent") updates.counterparty_signed_at = new Date().toISOString()
  if (to === "fully_signed") updates.fully_signed_at = new Date().toISOString()
  if (to === "locked") updates.locked_at = new Date().toISOString()
  const { data, error } = await client.from("document_versions").update(updates).eq("id", versionId).eq("user_id", userId).select("*").single()
  if (error || !data) throw new Error(error?.message ?? "Failed to transition")
  return data as DocumentVersionRow
}

export async function redraftFromLocked(
  client: Client,
  userId: string,
  sourceVersionId: string,
  newContent: string,
  changeSummary?: string,
  idempotencyKey?: string
): Promise<DocumentVersionRow> {
  if (!isUUID(sourceVersionId)) throw new Error("Invalid sourceVersionId")
  const source = await getDocumentVersion(client, userId, sourceVersionId)
  if (!source) throw new Error("Source not found")
  if (!["locked", "fully_signed", "superseded"].includes(source.status)) throw new Error(`Cannot redraft from status ${source.status}`)
  const key = idempotencyKey ?? `redraft:${sourceVersionId}:${Date.now()}`
  // Idempotency: if a child already exists with same key in provenance, return it
  const { data: existing } = await client
    .from("document_versions")
    .select("*")
    .eq("parent_version_id", sourceVersionId)
    .eq("user_id", userId)
    .contains("provenance", { redraft_key: key })
    .maybeSingle()
  if (existing) return existing as DocumentVersionRow

  const hash = `hash_${newContent.length}_${Date.now().toString(36)}`
  const { data, error } = await client
    .from("document_versions")
    .insert({
      audit_id: source.audit_id,
      user_id: userId,
      document_type: source.document_type,
      content: newContent,
      generation_method: "assembled",
      parent_version_id: sourceVersionId,
      content_hash: hash,
      provenance: { redraft_from: sourceVersionId, redraft_key: key, change_summary: changeSummary ?? "", source_hash: source.content_hash },
      status: "draft",
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed to redraft")
  // Mark source as superseded if it was locked (preserve history)
  if (source.status === "locked") {
    await client.from("document_versions").update({ status: "superseded", updated_at: new Date().toISOString() }).eq("id", sourceVersionId).eq("user_id", userId)
  }
  // Audit
  try {
    await client.from("activity_events").insert({ user_id: userId, audit_id: source.audit_id, event_type: "document_redraft", payload: { sourceVersionId, newVersionId: (data as { id: string }).id, changeSummary } })
  } catch {}
  return data as DocumentVersionRow
}

export async function getVersionHistory(client: Client, userId: string, auditId: string, documentType?: string): Promise<DocumentVersionRow[]> {
  let q = client.from("document_versions").select("*").eq("audit_id", auditId).eq("user_id", userId).order("version_number", { ascending: true })
  if (documentType) q = q.eq("document_type", documentType)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data as DocumentVersionRow[]) ?? []
}
