"use server"

import { randomBytes } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { assertSigningTransition, isLockedStatus, type SigningStatus } from "@/lib/signing/transitions"
import { advanceAfterSign, ceremonyProgress, mintSignerToken, sealContent, validateRecipients } from "@/lib/signing/ceremony"

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

interface SignerRow {
  id: string
  name: string
  email: string
  party_label: string
  token: string
  status: "pending" | "signed" | "declined" | "revoked"
  signed_at: string | null
}

interface VersionRow {
  id: string
  audit_id: string
  document_type: string
  version_number: number
  content: string
  status: string
  owner_signed_at: string | null
  fully_signed_at: string | null
  locked_at: string | null
  seal_hash: string | null
  signing_provenance: Record<string, unknown>
}

export interface CeremonySigner {
  id: string
  name: string
  email: string
  isOwner: boolean
  status: SignerRow["status"]
  signedAt: string | null
  link: string | null
}

export interface Ceremony {
  versionId: string
  auditId: string
  dealTitle: string
  familyTitle: string
  versionNumber: number
  status: string
  progress: { signed: number; total: number; complete: boolean; blocked: boolean }
  signers: CeremonySigner[]
  sealHash: string | null
  message: string | null
}

async function authedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return { supabase, user, userId: user.id, email: user.email ?? "" }
}

async function ownedVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  versionId: string
): Promise<VersionRow | null> {
  const { data } = await supabase
    .from("document_versions")
    .select("id, audit_id, document_type, version_number, content, status, owner_signed_at, fully_signed_at, locked_at, seal_hash, signing_provenance")
    .eq("id", versionId)
    .eq("user_id", userId)
    .maybeSingle()
  return (data as VersionRow | null) ?? null
}

async function versionSigners(
  supabase: Awaited<ReturnType<typeof createClient>>,
  versionId: string
): Promise<SignerRow[]> {
  const { data } = await supabase
    .from("document_signers")
    .select("id, name, email, party_label, token, status, signed_at")
    .eq("document_version_id", versionId)
    .order("created_at", { ascending: true })
  return ((data ?? []) as SignerRow[]).filter((s) => ["pending", "signed", "declined", "revoked"].includes(s.status))
}

function toCeremony(
  version: VersionRow,
  dealTitle: string,
  familyTitle: string,
  signers: SignerRow[]
): Ceremony {
  const progress = ceremonyProgress(
    signers.map((s) => ({ id: s.id, isOwner: s.party_label === "owner", status: s.status }))
  )
  return {
    versionId: version.id,
    auditId: version.audit_id,
    dealTitle,
    familyTitle,
    versionNumber: version.version_number,
    status: version.status,
    progress,
    signers: signers.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      isOwner: s.party_label === "owner",
      status: s.status,
      signedAt: s.signed_at,
      link: s.status === "pending" && !isLockedStatus(version.status) ? `/sign/${s.token}` : null,
    })),
    sealHash: version.seal_hash,
    message: typeof version.signing_provenance?.message === "string" ? (version.signing_provenance.message as string) : null,
  }
}

async function setVersionStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  version: VersionRow,
  to: SigningStatus,
  extra: Record<string, unknown> = {}
): Promise<void> {
  assertSigningTransition(version.status as SigningStatus, to)
  const { error } = await supabase
    .from("document_versions")
    .update({ status: to, updated_at: new Date().toISOString(), ...extra })
    .eq("id", version.id)
  if (error) throw new Error("We couldn't move that ceremony. Please try again.")
  version.status = to
}

/** Advance a version toward lock from its signer states. Idempotent. */
async function maybeFinalize(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  version: VersionRow
): Promise<VersionRow> {
  if (isLockedStatus(version.status)) return version
  const signers = await versionSigners(supabase, version.id)
  const progress = ceremonyProgress(
    signers.map((s) => ({ id: s.id, isOwner: s.party_label === "owner", status: s.status }))
  )
  const next = advanceAfterSign(version.status as SigningStatus, progress)
  if (next === null) {
    // Owner-signed with counterparties outstanding still moves off ready.
    if ((version.status === "ready_to_sign" || version.status === "ready_to_send") && progress.signed > 0) {
      await setVersionStatus(supabase, version, "owner_signed", { owner_signed_at: new Date().toISOString() })
      return { ...version, owner_signed_at: new Date().toISOString() }
    }
    return version
  }
  if (next === "fully_signed") {
    await setVersionStatus(supabase, version, "fully_signed", { fully_signed_at: new Date().toISOString() })
    const sealed = sealContent(version.content)
    await setVersionStatus(supabase, { ...version, status: "fully_signed" }, "locked", {
      locked_at: new Date().toISOString(),
      seal_hash: sealed,
    })
    try {
      const { ensureSigningMonitoring } = await import("@/lib/monitoring/actions")
      void ensureSigningMonitoring(version.audit_id)
    } catch {
      // Monitoring feeds Tracker best-effort; the lock stands regardless.
    }
    try {
      await supabase.from("activity_events").insert({
        user_id: userId,
        audit_id: version.audit_id,
        event_type: "document_locked",
        payload: { document_version_id: version.id, seal_hash: sealed },
      })
    } catch {
      // Audit trail is best-effort here; the lock trigger already guards truth.
    }
    return { ...version, status: "locked", seal_hash: sealed }
  }
  const stamps: Record<string, unknown> =
    next === "owner_signed" ? { owner_signed_at: new Date().toISOString() } : {}
  await setVersionStatus(supabase, version, next, stamps)
  return { ...version, status: next }
}

/**
 * Start a ceremony on a draft version: owner row plus counterparty rows
 * with token links, version to ready. Owner signs first (invites carry
 * no order beyond that in v1 — counterparties sign in parallel).
 */
export async function startCeremony(input: {
  versionId: string
  signers: Array<{ name: string; email: string }>
  message?: string
}): Promise<ActionOk<{ ceremony: Ceremony }> | ActionFail> {
  const authed = await authedUser()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId, email } = authed

  const problem = validateRecipients(input.signers)
  if (problem) return { ok: false, error: problem }
  const version = await ownedVersion(supabase, userId, input.versionId)
  if (!version) return { ok: false, error: "Document not found." }
  if (version.status !== "draft") return { ok: false, error: "Only drafts can enter signing." }

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("business_name")
    .eq("user_id", userId)
    .maybeSingle()
  const ownerName = ((profile as { business_name?: string | null } | null)?.business_name?.trim())
    || email.split("@")[0]
    || "Owner"

  const rows = [
    { audit_id: version.audit_id, document_type: version.document_type, document_version_id: version.id, name: ownerName, email: email.toLowerCase(), party_label: "owner", token: mintSignerToken() },
    ...input.signers.map((s) => ({
      audit_id: version.audit_id,
      document_type: version.document_type,
      document_version_id: version.id,
      name: s.name.trim(),
      email: s.email.trim().toLowerCase(),
      party_label: "signer",
      token: mintSignerToken(),
    })),
  ]
  if (rows.some((r) => r.email === email.toLowerCase() && r.party_label === "signer")) {
    return { ok: false, error: "You're already the owner — counterparties must use their own emails." }
  }
  const { error: insertError } = await supabase.from("document_signers").insert(rows)
  if (insertError) return { ok: false, error: "We couldn't add those signers. Please try again." }

  try {
    await setVersionStatus(supabase, version, "ready_to_sign", {
      signing_provenance: { ...(version.signing_provenance ?? {}), message: (input.message ?? "").trim().slice(0, 500) || null },
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "We couldn't start signing." }
  }
  const signers = await versionSigners(supabase, version.id)
  const { data: audit } = await supabase.from("audits").select("title").eq("id", version.audit_id).eq("user_id", userId).maybeSingle()
  return {
    ok: true,
    ceremony: toCeremony(
      { ...version, status: "ready_to_sign" },
      ((audit as { title?: string | null } | null)?.title?.trim() ? (audit as { title: string }).title : "Untitled"),
      version.document_type,
      signers
    ),
  }
}

/** Owner signs their own pending row, then advances/finalizes. */
export async function signAsOwnerAction(input: { signerId: string }): Promise<
  ActionOk<{ ceremony: Ceremony }> | ActionFail
> {
  const authed = await authedUser()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const { data, error } = await supabase.rpc("sign_as_owner", { p_signer_id: input.signerId })
  const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
  if (error || !row?.success) {
    return { ok: false, error: row?.message || "We couldn't record that signature." }
  }
  const { data: signer } = await supabase
    .from("document_signers")
    .select("document_version_id")
    .eq("id", input.signerId)
    .maybeSingle()
  const versionId = (signer as { document_version_id?: string } | null)?.document_version_id
  if (!versionId) return { ok: false, error: "Signature recorded." }
  let version = await ownedVersion(supabase, userId, versionId)
  if (!version) return { ok: false, error: "Signature recorded." }
  version = await maybeFinalize(supabase, userId, version)
  return { ok: true, ceremony: await loadCeremony(supabase, userId, version) }
}

async function loadCeremony(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  version: VersionRow
): Promise<Ceremony> {
  const signers = await versionSigners(supabase, version.id)
  const { data: audit } = await supabase.from("audits").select("title").eq("id", version.audit_id).eq("user_id", userId).maybeSingle()
  return toCeremony(
    version,
    ((audit as { title?: string | null } | null)?.title?.trim() ? (audit as { title: string }).title : "Untitled"),
    version.document_type,
    signers
  )
}

/** Add a counterparty mid-flight (correct-after-send). Locked versions refuse. */
export async function addSigner(input: { versionId: string; name: string; email: string }): Promise<
  ActionOk<{ ceremony: Ceremony }> | ActionFail
> {
  const authed = await authedUser()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const problem = validateRecipients([{ name: input.name, email: input.email }])
  if (problem) return { ok: false, error: problem }
  const version = await ownedVersion(supabase, userId, input.versionId)
  if (!version) return { ok: false, error: "Document not found." }
  if (isLockedStatus(version.status)) return { ok: false, error: "Locked documents can't take new signers — redraft instead." }
  const existing = await versionSigners(supabase, version.id)
  if (existing.some((s) => s.email.toLowerCase() === input.email.trim().toLowerCase())) {
    return { ok: false, error: "That email is already on this ceremony." }
  }
  const { error } = await supabase.from("document_signers").insert({
    audit_id: version.audit_id,
    document_type: version.document_type,
    document_version_id: version.id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    party_label: "signer",
    token: randomBytes(24).toString("hex"),
  })
  if (error) return { ok: false, error: "We couldn't add that signer. Please try again." }
  return { ok: true, ceremony: await loadCeremony(supabase, userId, version) }
}

/** Revoke a pending invitation. Signed rows are untouchable. */
export async function revokeSigner(input: { signerId: string }): Promise<
  ActionOk<{ ceremony: Ceremony }> | ActionFail
> {
  const authed = await authedUser()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const { data: signer } = await supabase
    .from("document_signers")
    .select("id, audit_id, document_version_id, status")
    .eq("id", input.signerId)
    .maybeSingle()
  const row = signer as { id: string; audit_id: string; document_version_id: string; status: string } | null
  if (!row) return { ok: false, error: "Signer not found." }
  const version = await ownedVersion(supabase, userId, row.document_version_id)
  if (!version) return { ok: false, error: "Document not found." }
  if (row.status !== "pending") return { ok: false, error: "Only pending invitations can be revoked." }
  const { error } = await supabase.from("document_signers").update({ status: "revoked" }).eq("id", row.id)
  if (error) return { ok: false, error: "We couldn't revoke that invitation." }
  const finalized = await maybeFinalize(supabase, userId, version)
  return { ok: true, ceremony: await loadCeremony(supabase, userId, finalized) }
}

/** Ceremonies across deals, newest activity first. Finalizes on view. */
export async function listCeremonies(): Promise<ActionOk<{ ceremonies: Ceremony[] }> | ActionFail> {
  const authed = await authedUser()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const { data: signerRows, error } = await supabase
    .from("document_signers")
    .select("document_version_id")
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) return { ok: false, error: "We couldn't load signing. Please try again." }
  // Owner scope: join through audits via versions below; RLS on versions enforces it.
  const versionIds = [...new Set(((signerRows ?? []) as Array<{ document_version_id: string }>).map((r) => r.document_version_id))]
  if (versionIds.length === 0) return { ok: true, ceremonies: [] }

  const { data: versions } = await supabase
    .from("document_versions")
    .select("id, audit_id, document_type, version_number, content, status, owner_signed_at, fully_signed_at, locked_at, seal_hash, signing_provenance")
    .eq("user_id", userId)
    .in("id", versionIds)
    .order("updated_at", { ascending: false })
    .limit(50)
  const versionRows = ((versions ?? []) as VersionRow[]).filter((v) => !["draft"].includes(v.status))
  const titles = new Map<string, string>()
  const auditIds = [...new Set(versionRows.map((v) => v.audit_id))]
  if (auditIds.length > 0) {
    const { data: audits } = await supabase.from("audits").select("id, title").eq("user_id", userId).in("id", auditIds)
    for (const a of ((audits ?? []) as Array<{ id: string; title: string | null }>)) {
      titles.set(a.id, a.title?.trim() ? a.title : "Untitled")
    }
  }
  const ceremonies: Ceremony[] = []
  for (const v of versionRows) {
    const finalized = await maybeFinalize(supabase, userId, v).catch(() => v)
    const signers = await versionSigners(supabase, finalized.id)
    ceremonies.push(toCeremony(finalized, titles.get(finalized.audit_id) ?? "Untitled", finalized.document_type, signers))
  }
  return { ok: true, ceremonies }
}
