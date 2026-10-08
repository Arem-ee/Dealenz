"use server"

import { randomUUID } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
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

/** Portal view: deal title, grant scope, and version metadata. Null when invalid. */
export async function getGuestPortal(token: string): Promise<GuestPortalState | null> {
  if (!validToken(token)) return null
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
  if (!sniffUploadMime(buffer)) return { ok: false, error: "That file isn't a readable document." }
  const svc = await serviceClient()
  if (!svc) return { ok: false, error: "Uploads are unavailable right now — please try again later." }
  const { data: audit } = await svc.from("audits").select("user_id").eq("id", allowed.deal_id).maybeSingle()
  const ownerId = (audit as { user_id?: string } | null)?.user_id
  if (!ownerId) return { ok: false, error: "That upload link is no longer valid." }

  const uploadId = randomUUID()
  const name = sanitizeFilename(file.name)
  const path = `${ownerId}/${allowed.deal_id}/staged/${uploadId}/${name}`
  const { error: upError } = await svc.storage.from("audit-files").upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (upError) return { ok: false, error: "We couldn't store that file. Please try again." }
  const { error: rowError } = await svc.from("staged_uploads").insert({
    id: uploadId,
    deal_id: allowed.deal_id,
    grant_id: allowed.grant_id,
    file_name: name,
    storage_path: path,
    mime: file.type,
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
