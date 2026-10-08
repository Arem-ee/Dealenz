"use server"

import { randomUUID } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { extractTextFromBuffer } from "@/lib/text-extract"
import { sniffUploadMime } from "@/lib/validation/files"
import {
  audienceLabel,
  guestPortalPath,
  isGuestAudience,
  isGuestScope,
  normalizeGuestEmail,
  type GuestAudience,
  type GuestScope,
} from "@/lib/guests/grants"

// Guest access (Phase C, D4/D5/D7/D9/D10): invitation-only token grants on
// one external surface. Readers view versions + findings; the single primary
// uploader per deal uploads redlines back staged outside version control;
// the owner accepts staged files into new versions (history append-only) or
// rejects them. Grants expire and auto-revoke.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface GuestGrantView {
  id: string
  email: string
  audience: GuestAudience
  scope: GuestScope
  isPrimaryOwner: boolean
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

export interface StagedUploadView {
  id: string
  fileName: string
  mime: string
  sizeBytes: number
  status: "pending" | "accepted" | "rejected"
  grantEmail: string
  createdAt: string
}

async function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const { createClient: createServiceClient } = await import("@supabase/supabase-js")
  return createServiceClient(url, key)
}

/** Owner view: every grant on the deal, including revoked history. */
export async function listGuestGrants(auditId: string): Promise<
  { ok: true; grants: GuestGrantView[] } | { ok: false; error: string }
> {
  if (!UUID_RE.test(auditId)) return { ok: false, error: "Invalid deal." }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data, error } = await supabase
    .from("guest_grants")
    .select("id, email, audience, scope, is_primary_owner, expires_at, revoked_at, created_at")
    .eq("deal_id", auditId)
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) {
    if (error.message.includes("guest_grants")) {
      return { ok: false, error: "External access needs a database update (migration 00113). Please try again after migrating." }
    }
    return { ok: false, error: "We couldn't load external access. Please try again." }
  }
  const grants: GuestGrantView[] = []
  for (const r of ((data ?? []) as Array<Record<string, unknown>>)) {
    if (typeof r.id !== "string" || typeof r.email !== "string") continue
    if (!isGuestAudience(r.audience) || !isGuestScope(r.scope)) continue
    grants.push({
      id: r.id,
      email: r.email,
      audience: r.audience,
      scope: r.scope,
      isPrimaryOwner: r.is_primary_owner === true,
      expiresAt: typeof r.expires_at === "string" ? r.expires_at : null,
      revokedAt: typeof r.revoked_at === "string" ? r.revoked_at : null,
      createdAt: typeof r.created_at === "string" ? r.created_at : "",
    })
  }
  return { ok: true, grants }
}

/**
 * Owner invites an external by email. Returns the portal link to share —
 * shown once, out of band (email/message), never logged.
 */
export async function inviteGuest(input: {
  auditId: string
  email: string
  audience: GuestAudience
  scope: GuestScope
  primaryOwner?: boolean
  expiresInDays?: number | null
}): Promise<{ ok: true; portalPath: string; grant: GuestGrantView } | { ok: false; error: string }> {
  if (!UUID_RE.test(input.auditId)) return { ok: false, error: "Invalid deal." }
  const email = normalizeGuestEmail(input.email)
  if (!email) return { ok: false, error: "Enter a valid email for the external." }
  if (!isGuestAudience(input.audience)) return { ok: false, error: "Unknown audience." }
  if (!isGuestScope(input.scope)) return { ok: false, error: "Unknown scope." }
  const primary = input.scope === "uploader" && input.primaryOwner === true
  let expiresAt: string | null = null
  if (input.expiresInDays !== undefined && input.expiresInDays !== null) {
    const days = Math.floor(input.expiresInDays)
    if (!Number.isFinite(days) || days < 1 || days > 365) return { ok: false, error: "Expiry is 1–365 days." }
    expiresAt = new Date(Date.now() + days * 86_400_000).toISOString()
  }
  const supabase = await createClient()
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "")
  const { data, error } = await supabase.rpc("create_guest_grant", {
    p_deal_id: input.auditId,
    p_email: email,
    p_audience: input.audience,
    p_scope: input.scope,
    p_is_primary_owner: primary,
    p_token: token,
    p_expires_at: expiresAt,
  })
  if (error) {
    if (error.message.includes("guest_grants")) {
      return { ok: false, error: "External access needs a database update (migration 00113). Please try again after migrating." }
    }
    return { ok: false, error: "We couldn't invite that external. Please try again." }
  }
  const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
  if (!row?.success) return { ok: false, error: row?.message || "We couldn't invite that external. Please try again." }
  try {
    const { notifyDealOwner } = await import("@/lib/notifications/notify")
    const svc = await serviceClient()
    if (svc) {
      await notifyDealOwner(svc, input.auditId, {
        type: "status",
        title: `${audienceLabel(input.audience)} invited`,
        body: `${email} can view this deal as ${input.audience}${primary ? " and upload redlines back" : ""}. Share the portal link out of band.`,
        link: "/dashboard",
      })
    }
  } catch {
    // The grant stands regardless; the notification is best-effort.
  }
  const listed = await listGuestGrants(input.auditId)
  const grant = listed.ok ? listed.grants.find((g) => g.email === email) ?? null : null
  return {
    ok: true,
    portalPath: guestPortalPath(token),
    grant: grant ?? {
      id: "", email, audience: input.audience, scope: input.scope,
      isPrimaryOwner: primary, expiresAt, revokedAt: null, createdAt: new Date().toISOString(),
    },
  }
}

export async function revokeGuestGrant(input: {
  auditId: string
  grantId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(input.auditId) || !UUID_RE.test(input.grantId)) {
    return { ok: false, error: "That grant no longer exists." }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("revoke_guest_grant", {
    p_deal_id: input.auditId,
    p_grant_id: input.grantId,
  })
  if (error) return { ok: false, error: "We couldn't revoke that access. Please try again." }
  const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
  if (!row?.success) return { ok: false, error: row?.message || "That grant no longer exists." }
  return { ok: true }
}

/** Owner view: staged counterparty files awaiting a decision. */
export async function listStagedUploads(auditId: string): Promise<
  { ok: true; uploads: StagedUploadView[] } | { ok: false; error: string }
> {
  if (!UUID_RE.test(auditId)) return { ok: false, error: "Invalid deal." }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const { data, error } = await supabase
    .from("staged_uploads")
    .select("id, file_name, mime, size_bytes, status, created_at, guest_grants!inner(email)")
    .eq("deal_id", auditId)
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) {
    if (typeof error.message === "string" && error.message.includes("staged_uploads")) {
      return { ok: false, error: "External access needs a database update (migration 00113). Please try again after migrating." }
    }
    return { ok: false, error: "We couldn't load staged files. Please try again." }
  }
  const uploads: StagedUploadView[] = []
  for (const r of ((data ?? []) as Array<Record<string, unknown>>)) {
    if (typeof r.id !== "string" || typeof r.file_name !== "string") continue
    const status = r.status
    if (status !== "pending" && status !== "accepted" && status !== "rejected") continue
    const grant = r.guest_grants as { email?: unknown } | null
    uploads.push({
      id: r.id,
      fileName: r.file_name,
      mime: typeof r.mime === "string" ? r.mime : "",
      sizeBytes: typeof r.size_bytes === "number" ? r.size_bytes : 0,
      status,
      grantEmail: typeof grant?.email === "string" ? grant.email : "",
      createdAt: typeof r.created_at === "string" ? r.created_at : "",
    })
  }
  return { ok: true, uploads }
}

/**
 * Owner decides a staged file. Accepting extracts its text and appends a
 * counterparty version (history append-only, never rewritten); rejecting
 * just marks it. Either way the staged file stays for the audit trail.
 */
export async function decideStagedUpload(input: {
  uploadId: string
  accept: boolean
}): Promise<{ ok: true; versionNumber?: number } | { ok: false; error: string }> {
  if (!UUID_RE.test(input.uploadId)) return { ok: false, error: "That upload no longer exists." }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }
  const svc = await serviceClient()
  if (!svc) return { ok: false, error: "Service unavailable — please try again later." }

  const { data: staged } = await svc
    .from("staged_uploads")
    .select("id, deal_id, file_name, storage_path, mime, status")
    .eq("id", input.uploadId)
    .maybeSingle()
  const row = staged as {
    id: string; deal_id: string; file_name: string; storage_path: string; mime: string; status: string
  } | null
  if (!row || row.status !== "pending") return { ok: false, error: "That upload is already decided." }
  const { data: audit } = await svc.from("audits").select("id, user_id").eq("id", row.deal_id).maybeSingle()
  if (!audit || (audit as { user_id: string }).user_id !== user.id) {
    return { ok: false, error: "Only the deal owner decides staged uploads." }
  }

  if (!input.accept) {
    const { data, error } = await supabase.rpc("decide_staged_upload", { p_upload_id: row.id, p_accept: false })
    if (error) return { ok: false, error: "We couldn't reject that file. Please try again." }
    const ok = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
    if (!ok?.success) return { ok: false, error: ok?.message || "That upload is already decided." }
    return { ok: true }
  }

  // Accept: download, extract, append a counterparty version, then mark.
  const { data: file, error: dlError } = await svc.storage.from("audit-files").download(row.storage_path)
  if (dlError || !file) return { ok: false, error: "We couldn't read that file. Please try again." }
  const buffer = Buffer.from(await file.arrayBuffer())
  const sniffed = sniffUploadMime(buffer)
  if (!sniffed) return { ok: false, error: "That file isn't a readable document." }
  let text: string
  try {
    text = await extractTextFromBuffer(buffer, sniffed)
  } catch {
    return { ok: false, error: "We couldn't read that file. Please try again." }
  }
  if (!text.trim()) return { ok: false, error: "That file has no readable text." }
  const { data: latest } = await svc
    .from("document_versions")
    .select("version_number")
    .eq("audit_id", row.deal_id)
    .eq("document_type", "counterparty-redline")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  const next = (typeof (latest as { version_number?: number } | null)?.version_number === "number"
    ? (latest as { version_number: number }).version_number
    : 0) + 1
  const { error: versionError } = await svc.from("document_versions").insert({
    audit_id: row.deal_id,
    user_id: user.id,
    document_type: "counterparty-redline",
    version_number: next,
    content: text.slice(0, 500_000),
    generation_method: "counterparty",
    status: "draft",
    created_at: new Date().toISOString(),
  })
  if (versionError) {
    const msg = (versionError.message ?? "").toLowerCase()
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false, error: "That redline was already filed — refresh to see it." }
    }
    return { ok: false, error: "We couldn't file that redline. Please try again." }
  }
  const { data, error } = await supabase.rpc("decide_staged_upload", { p_upload_id: row.id, p_accept: true })
  if (error) return { ok: false, error: "Filed, but the staged record didn't flip — it stays pending." }
  const ok = (Array.isArray(data) ? data[0] : data) as { success?: boolean } | null
  if (!ok?.success) return { ok: false, error: "Filed, but the staged record didn't flip — it stays pending." }
  return { ok: true, versionNumber: next }
}
