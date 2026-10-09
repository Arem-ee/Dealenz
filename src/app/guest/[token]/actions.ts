"use server"

import { randomUUID } from "node:crypto"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { checkAnonymousRateLimit, getTrustedClientIp } from "@/lib/rate-limit-anon"
import { isValidFileSize, MAX_EXTRACTED_CHARS } from "@/lib/text-extract"
import { sanitizeFilename, sniffUploadMime, SUPPORTED_UPLOAD_MIMES } from "@/lib/validation/files"
import { isGuestAudience, isGuestScope, type GuestAudience, type GuestScope } from "@/lib/guests/grants"

// Public guest portal (Phase C, D4/D9/D10): token principals, never members.
// Every action verifies the live grant server-side and fails closed on
// unknown, expired, or revoked tokens. No account, no session.

async function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const { createClient: createServiceClient } = await import("@supabase/supabase-js")
  return createServiceClient(url, key)
}

export interface GuestVersionMeta {
  id: string
  documentType: string
  versionNumber: number
  status: string | null
  createdAt: string
}

export interface GuestComment {
  body: string
  resolved: boolean
  createdAt: string | null
}

/** External-channel comments for the portal (resolution state included). */
export async function getGuestComments(token: string): Promise<
  { ok: true; comments: GuestComment[] } | { ok: false; error: string }
> {
  if (!validToken(token)) return { ok: false, error: "That link is no longer valid." }
  if (!(await guestQuota())) return { ok: false, error: "Too many attempts. Please try again later." }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_guest_comments", { p_token: token })
  if (error || !data) return { ok: false, error: "That link is no longer valid." }
  const comments: GuestComment[] = []
  for (const r of ((Array.isArray(data) ? data : [data]) as Array<Record<string, unknown>>)) {
    if (typeof r.body !== "string") continue
    comments.push({
      body: r.body,
      resolved: r.resolved === true,
      createdAt: typeof r.created_at === "string" ? r.created_at : null,
    })
  }
  return { ok: true, comments }
}

/**
 * Counterparty comment posting. The RPC forces channel='external' and
 * enforces the commenter-or-broader scope plus a per-grant daily cap —
 * guests can never address the internal channel.
 */
export async function postGuestComment(token: string, body: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!validToken(token)) return { ok: false, error: "That link is no longer valid." }
  if (!(await guestQuota())) return { ok: false, error: "Too many attempts. Please try again later." }
  const text = (body ?? "").trim().slice(0, 2000)
  if (!text) return { ok: false, error: "Write the comment first." }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("post_guest_comment", { p_token: token, p_body: text, p_round_id: null })
  if (error) return { ok: false, error: "We couldn't post that comment. Please try again." }
  const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
  if (!row?.success) return { ok: false, error: row?.message || "That link is no longer valid." }
  return { ok: true }
}

export interface GuestRoundRow {
  kind: "position" | "comment"
  roundNo: number | null
  stance: string | null
  status: string | null
  clauseId: string | null
  outcome: string | null
  rung: number | null
  variant: string | null
  reasoning: string | null
  counterText: string | null
  commentBody: string | null
  commentCreatedAt: string | null
}

/**
 * Negotiation visibility for the counterparty: round dispositions with
 * counter-language plus the EXTERNAL comment channel only. Internal
 * strategy can never pass through this path — the channel predicate and
 * the grant check both fail closed first.
 */
export async function getGuestNegotiation(token: string): Promise<
  { ok: true; rows: GuestRoundRow[] } | { ok: false; error: string }
> {
  if (!validToken(token)) return { ok: false, error: "That link is no longer valid." }
  if (!(await guestQuota())) return { ok: false, error: "Too many attempts. Please try again later." }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_guest_negotiation", { p_token: token })
  if (error || !data) return { ok: false, error: "That link is no longer valid." }
  const rows: GuestRoundRow[] = []
  for (const r of ((Array.isArray(data) ? data : [data]) as Array<Record<string, unknown>>)) {
    if (r.comment_body !== null && r.comment_body !== undefined) {
      if (typeof r.comment_body !== "string") continue
      rows.push({
        kind: "comment",
        roundNo: null, stance: null, status: null, clauseId: null, outcome: null,
        rung: null, variant: null, reasoning: null, counterText: null,
        commentBody: r.comment_body,
        commentCreatedAt: typeof r.comment_created_at === "string" ? r.comment_created_at : null,
      })
    } else {
      if (typeof r.round_no !== "number") continue
      rows.push({
        kind: "position",
        roundNo: r.round_no,
        stance: typeof r.stance === "string" ? r.stance : null,
        status: typeof r.status === "string" ? r.status : null,
        clauseId: typeof r.clause_id === "string" ? r.clause_id : null,
        outcome: typeof r.outcome === "string" ? r.outcome : null,
        rung: typeof r.rung === "number" ? r.rung : null,
        variant: typeof r.variant === "string" ? r.variant : null,
        reasoning: typeof r.reasoning === "string" ? r.reasoning : null,
        counterText: typeof r.counter_text === "string" ? r.counter_text : null,
        commentBody: null, commentCreatedAt: null,
      })
    }
  }
  return { ok: true, rows }
}

export interface GuestPortalState {
  dealTitle: string
  audience: GuestAudience
  scope: GuestScope
  isPrimaryOwner: boolean
  expiresAt: string | null
  versions: GuestVersionMeta[]
}

function validToken(token: string): boolean {
  return typeof token === "string" && token.length >= 32 && token.length <= 200
}

async function guestQuota(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const ip = getTrustedClientIp(await headers())
    const quota = await checkAnonymousRateLimit(supabase, `guest:${ip}`, 120, 3600)
    return quota.allowed
  } catch {
    return false
  }
}

/** Portal view: deal title, grant scope, and version metadata. Null when invalid. */
export async function getGuestPortal(token: string): Promise<GuestPortalState | null> {
  if (!validToken(token)) return null
  if (!(await guestQuota())) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_guest_view", { p_token: token })
  if (error || !data) return null
  const rows = (Array.isArray(data) ? data : [data]) as Array<Record<string, unknown>>
  if (rows.length === 0 || typeof rows[0]?.deal_title !== "string") return null
  const first = rows[0]!
  if (!isGuestAudience(first.audience) || !isGuestScope(first.scope)) return null
  const versions: GuestVersionMeta[] = []
  for (const r of rows) {
    if (typeof r.version_id !== "string") continue
    versions.push({
      id: r.version_id,
      documentType: typeof r.document_type === "string" ? r.document_type : "",
      versionNumber: typeof r.version_number === "number" ? r.version_number : 0,
      status: typeof r.version_status === "string" ? r.version_status : null,
      createdAt: typeof r.version_created_at === "string" ? r.version_created_at : "",
    })
  }
  return {
    dealTitle: (first.deal_title as string).trim() || "Untitled",
    audience: first.audience,
    scope: first.scope,
    isPrimaryOwner: first.is_primary_owner === true,
    expiresAt: typeof first.expires_at === "string" ? first.expires_at : null,
    versions,
  }
}

/** One version's content for the reader, truncated for the portal. */
export async function getGuestContent(token: string, versionId: string): Promise<
  { ok: true; content: string; truncated: boolean; documentType: string } | { ok: false; error: string }
> {
  if (!validToken(token)) return { ok: false, error: "That link is no longer valid." }
  if (!(await guestQuota())) return { ok: false, error: "Too many attempts. Please try again later." }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_guest_version_content", { p_token: token, p_version_id: versionId })
  if (error || !data) return { ok: false, error: "That link is no longer valid." }
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined
  if (!row || typeof row.content !== "string") return { ok: false, error: "That document is no longer shared." }
  const full = row.content as string
  const truncated = full.length > MAX_EXTRACTED_CHARS
  return {
    ok: true,
    content: truncated ? full.slice(0, MAX_EXTRACTED_CHARS) : full,
    truncated,
    documentType: typeof row.document_type === "string" ? row.document_type : "",
  }
}

/**
 * Primary-owner upload-back: the redline stages OUTSIDE version control.
 * Validated (live uploader grant, type-sniffed, sized, sanitized) then stored
 * for the owner to accept or reject. The grant check and the insert are one
 * service-side unit; any failure fails closed with nothing staged.
 */
export async function uploadStagedRedline(
  token: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!validToken(token)) return { ok: false, error: "That upload link is no longer valid." }
  if (!(await guestQuota())) return { ok: false, error: "Too many attempts. Please try again later." }
  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, error: "Choose a file first." }
  if (!isValidFileSize(file.size)) return { ok: false, error: "Files top out at 10MB." }
  if (!(SUPPORTED_UPLOAD_MIMES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "PDF, DOCX, or TXT only." }
  }
  const supabase = await createClient()
  const { data: check, error: checkError } = await supabase.rpc("check_staged_upload", { p_token: token })
  if (checkError || !check) return { ok: false, error: "That upload link is no longer valid." }
  const allowed = (Array.isArray(check) ? check[0] : check) as
    { success?: boolean; message?: string; deal_id?: string; grant_id?: string } | null
  if (!allowed?.success || !allowed.deal_id || !allowed.grant_id) {
    return { ok: false, error: allowed?.message || "That upload link is no longer valid." }
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const sniffed = sniffUploadMime(buffer)
  if (!sniffed) return { ok: false, error: "That file isn't a readable document." }
  if (sniffed !== file.type) return { ok: false, error: "File content does not match its declared type." }
  const svc = await serviceClient()
  if (!svc) return { ok: false, error: "Uploads are unavailable right now — please try again later." }
  const { data: audit } = await svc.from("audits").select("user_id").eq("id", allowed.deal_id).maybeSingle()
  const ownerId = (audit as { user_id?: string } | null)?.user_id
  if (!ownerId) return { ok: false, error: "That upload link is no longer valid." }

  const uploadId = randomUUID()
  const name = sanitizeFilename(file.name)
  const path = `${ownerId}/${allowed.deal_id}/staged/${uploadId}/${name}`
  const { error: upError } = await svc.storage.from("audit-files").upload(path, buffer, {
    contentType: sniffed,
    upsert: false,
  })
  if (upError) return { ok: false, error: "We couldn't store that file. Please try again." }
  const { error: rowError } = await svc.from("staged_uploads").insert({
    id: uploadId,
    deal_id: allowed.deal_id,
    grant_id: allowed.grant_id,
    file_name: name,
    storage_path: path,
    mime: sniffed,
    size_bytes: buffer.length,
    status: "pending",
  })
  if (rowError) {
    await svc.storage.from("audit-files").remove([path]).catch(() => undefined)
    return { ok: false, error: "We couldn't stage that file. Please try again." }
  }
  try {
    const { notifyDealOwner } = await import("@/lib/notifications/notify")
    await notifyDealOwner(svc, allowed.deal_id, {
      type: "status",
      title: "Counterparty redline staged",
      body: `${name} is staged outside version control — accept it into a new version or reject it.`,
      link: "/dashboard",
    })
  } catch {
    // The file is staged regardless; the notification is best-effort.
  }
  return { ok: true }
}
