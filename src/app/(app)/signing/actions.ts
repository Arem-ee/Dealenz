"use server"

import { headers } from "next/headers"
import { randomBytes } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { assertSigningTransition, isLockedStatus, type SigningStatus } from "@/lib/signing/transitions"
import {
  advanceAfterSign,
  assignSignOrder,
  ceremonyProgress,
  expiryTimestamp,
  mintSignerToken,
  normalizeExpiryDays,
  sealContent,
  validateRecipients,
  waitingOnEarlier,
} from "@/lib/signing/ceremony"

type ActionOk<T> = { ok: true } & T
type ActionFail = { ok: false; error: string }

type SignerStatus = "pending" | "signed" | "declined" | "revoked" | "expired"

interface SignerRow {
  id: string
  name: string
  email: string
  party_label: string
  token: string
  status: SignerStatus
  signed_at: string | null
  expires_at: string | null
  sign_order: number
  created_at: string
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
  status: SignerStatus
  signedAt: string | null
  expiresAt: string | null
  signOrder: number
  waitingOnEarlier: boolean
  hasSignatureImage: boolean
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
  allowForward: boolean
}

export interface MailSummary {
  emailed: string[]
  needsCopy: string[]
  gmailConnected: boolean
}

async function authedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return { supabase, user, userId: user.id, email: user.email ?? "", emailConfirmed: Boolean(user.email_confirmed_at) }
}

type Authed = NonNullable<Awaited<ReturnType<typeof authedUser>>>

function requireConfirmed(authed: Authed): ActionFail | null {
  if (!authed.emailConfirmed) {
    return { ok: false, error: "Verify your email address before sending for signature." }
  }
  return null
}

async function checkInviteRate(): Promise<ActionFail | null> {
  const { checkRateLimit } = await import("@/lib/rate-limit")
  const rate = await checkRateLimit("document_invite")
  if (!rate.allowed) return { ok: false, error: rate.error ?? "Invite rate limit reached — try again later." }
  return null
}

async function absoluteSignLink(token: string): Promise<string> {
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  return `${proto}://${host}/sign/${token}`
}

async function ownedVersion(
  supabase: Authed["supabase"],
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
  supabase: Authed["supabase"],
  versionId: string
): Promise<SignerRow[]> {
  const { data } = await supabase
    .from("document_signers")
    .select("id, name, email, party_label, token, status, signed_at, expires_at, sign_order, created_at")
    .eq("document_version_id", versionId)
    .order("sign_order", { ascending: true })
    .order("created_at", { ascending: true })
  return ((data ?? []) as SignerRow[]).filter((s) => ["pending", "signed", "declined", "revoked", "expired"].includes(s.status))
}

async function artifactMethods(
  supabase: Authed["supabase"],
  signerIds: string[]
): Promise<Set<string>> {
  if (signerIds.length === 0) return new Set()
  const { data } = await supabase
    .from("signer_signature_artifacts")
    .select("signer_id")
    .in("signer_id", signerIds)
  return new Set(((data ?? []) as Array<{ signer_id: string }>).map((r) => r.signer_id))
}

function toCeremony(
  version: VersionRow,
  dealTitle: string,
  familyTitle: string,
  signers: SignerRow[],
  withImage: Set<string>
): Ceremony {
  const states = signers.map((s) => ({ id: s.id, isOwner: s.party_label === "owner", status: s.status }))
  const progress = ceremonyProgress(states)
  const ordered = signers.map((s) => ({
    id: s.id,
    isOwner: s.party_label === "owner",
    status: s.status,
    signOrder: s.sign_order ?? 0,
  }))
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
      expiresAt: s.expires_at,
      signOrder: s.sign_order ?? 0,
      waitingOnEarlier: waitingOnEarlier(ordered, s.id),
      hasSignatureImage: withImage.has(s.id),
      link: (s.status === "pending" || s.status === "expired") && !isLockedStatus(version.status) ? `/sign/${s.token}` : null,
    })),
    sealHash: version.seal_hash,
    message: typeof version.signing_provenance?.message === "string" ? (version.signing_provenance.message as string) : null,
    allowForward: (version.signing_provenance?.allowForward as boolean | undefined) !== false,
  }
}

async function setVersionStatus(
  supabase: Authed["supabase"],
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
  supabase: Authed["supabase"],
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

async function loadCeremony(
  supabase: Authed["supabase"],
  userId: string,
  version: VersionRow
): Promise<Ceremony> {
  const signers = await versionSigners(supabase, version.id)
  const withImage = await artifactMethods(supabase, signers.map((s) => s.id))
  const { data: audit } = await supabase.from("audits").select("title").eq("id", version.audit_id).eq("user_id", userId).maybeSingle()
  return toCeremony(
    version,
    ((audit as { title?: string | null } | null)?.title?.trim() ? (audit as { title: string }).title : "Untitled"),
    version.document_type,
    signers,
    withImage
  )
}

/** Email one counterparty their link. Returns true when Gmail delivered. */
async function mailInvite(
  authed: Authed,
  dealTitle: string,
  familyTitle: string,
  to: { name: string; email: string; token: string; expiresAt: string | null },
  fromName: string
): Promise<boolean> {
  const { sendSignerInviteEmail } = await import("@/lib/signing/mail")
  const link = await absoluteSignLink(to.token)
  const res = await sendSignerInviteEmail(authed.supabase, authed.userId, {
    to: to.email,
    toName: to.name,
    dealTitle,
    familyTitle,
    link,
    expiresAt: to.expiresAt,
    fromName,
  })
  return res.sent
}

/**
 * Start a ceremony on a draft version: owner row (step 0) plus
 * counterparty rows with token links, version to ready. Counterparties
 * share step 1 by default (sign in parallel after the owner) or walk
 * numbered steps when sequential. Every invitation carries the same
 * expiry; email delivery is attempted per invitee and reported back —
 * copy-link always works regardless.
 */
export async function startCeremony(input: {
  versionId: string
  signers: Array<{ name: string; email: string }>
  message?: string
  expiresInDays?: number
  sequential?: boolean
  allowForward?: boolean
}): Promise<ActionOk<{ ceremony: Ceremony; mail: MailSummary }> | ActionFail> {
  const authed = await authedUser()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const confirmed = requireConfirmed(authed)
  if (confirmed) return confirmed
  const { supabase, userId, email } = authed

  const problem = validateRecipients(input.signers)
  if (problem) return { ok: false, error: problem }
  const expiryDays = normalizeExpiryDays(input.expiresInDays)
  if (expiryDays === null) return { ok: false, error: "Expiry must be 1 to 120 days." }
  const rate = await checkInviteRate()
  if (rate) return rate

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

  const expiresAt = expiryTimestamp(expiryDays)
  const orders = assignSignOrder(input.signers.length, input.sequential === true)
  const rows = [
    { audit_id: version.audit_id, document_type: version.document_type, document_version_id: version.id, name: ownerName, email: email.toLowerCase(), party_label: "owner", token: mintSignerToken(), sign_order: 0, expires_at: expiresAt },
    ...input.signers.map((s, i) => ({
      audit_id: version.audit_id,
      document_type: version.document_type,
      document_version_id: version.id,
      name: s.name.trim(),
      email: s.email.trim().toLowerCase(),
      party_label: "signer",
      token: mintSignerToken(),
      sign_order: orders[i] ?? 1,
      expires_at: expiresAt,
    })),
  ]
  if (rows.some((r) => r.email === email.toLowerCase() && r.party_label === "signer")) {
    return { ok: false, error: "You're already the owner — counterparties must use their own emails." }
  }
  const { error: insertError } = await supabase.from("document_signers").insert(rows)
  if (insertError) return { ok: false, error: "We couldn't add those signers. Please try again." }

  try {
    await setVersionStatus(supabase, version, "ready_to_sign", {
      signing_provenance: {
        ...(version.signing_provenance ?? {}),
        message: (input.message ?? "").trim().slice(0, 500) || null,
        allowForward: input.allowForward !== false,
        expiresInDays: expiryDays,
        sequential: input.sequential === true,
      },
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "We couldn't start signing." }
  }

  const { data: audit } = await supabase.from("audits").select("title").eq("id", version.audit_id).eq("user_id", userId).maybeSingle()
  const dealTitle = ((audit as { title?: string | null } | null)?.title?.trim() ? (audit as { title: string }).title : "Untitled")

  const mail: MailSummary = { emailed: [], needsCopy: [], gmailConnected: true }
  for (const s of input.signers) {
    const row = rows.find((r) => r.email === s.email.trim().toLowerCase() && r.party_label === "signer")
    if (!row) continue
    try {
      const sent = await mailInvite(authed, dealTitle, version.document_type, { name: row.name, email: row.email, token: row.token, expiresAt }, ownerName)
      if (sent) mail.emailed.push(row.email)
      else {
        mail.needsCopy.push(row.email)
        mail.gmailConnected = false
      }
    } catch {
      mail.needsCopy.push(row.email)
      mail.gmailConnected = false
    }
  }

  return { ok: true, ceremony: await loadCeremony(supabase, userId, { ...version, status: "ready_to_sign" }), mail }
}

/**
 * Owner signs their own pending row, then advances/finalizes.
 * Consent is explicit: the owner confirms the electronic-signature
 * disclosure in the UI, and the confirmation timestamp lands in the
 * ceremony provenance. An optional drawn/typed image is stored
 * artifact-first, so a recorded signature always carries its image.
 */
export async function signAsOwnerAction(input: {
  signerId: string
  consent?: boolean
  imageData?: string
  method?: string
}): Promise<ActionOk<{ ceremony: Ceremony }> | ActionFail> {
  const authed = await authedUser()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const confirmed = requireConfirmed(authed)
  if (confirmed) return confirmed
  const { supabase, userId } = authed
  if (input.consent !== true) {
    return { ok: false, error: "Confirm you agree to sign electronically first." }
  }

  if (input.imageData !== undefined || input.method !== undefined) {
    const { validateSignatureArtifact } = await import("@/lib/signatures/validate")
    const valid = validateSignatureArtifact({ imageData: input.imageData, method: input.method })
    if (!valid.ok) return { ok: false, error: valid.error }
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceUrl || !serviceKey) return { ok: false, error: "Service unavailable. Please try again." }
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const service = createServiceClient(serviceUrl, serviceKey)
    const { error: artifactError } = await service.from("signer_signature_artifacts").upsert(
      { signer_id: input.signerId, image_data: valid.imageData, method: valid.method },
      { onConflict: "signer_id" }
    )
    if (artifactError) return { ok: false, error: "Could not save the signature image. Please try again." }
  }

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
  try {
    await supabase.from("document_versions").update({
      signing_provenance: {
        ...(version.signing_provenance ?? {}),
        ownerConsentAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }).eq("id", version.id)
  } catch {
    // Consent evidence is best-effort; the signature row stands regardless.
  }
  version = await maybeFinalize(supabase, userId, version)
  if (version.status === "locked") {
    try {
      const { createNotification } = await import("@/lib/notifications/store")
      const { data: audit } = await supabase.from("audits").select("title").eq("id", version.audit_id).eq("user_id", userId).maybeSingle()
      const dealTitle = ((audit as { title?: string | null } | null)?.title?.trim() ? (audit as { title: string }).title : "Untitled")
      await createNotification(supabase, {
        userId,
        type: "success",
        title: "Document sealed",
        body: `“${dealTitle}” collected every signature and is sealed against edits.`,
        link: "/signing",
      })
    } catch {
      // The seal stands regardless; the notification is best-effort.
    }
  }
  return { ok: true, ceremony: await loadCeremony(supabase, userId, version) }
}

/** Add a counterparty mid-flight (correct-after-send). Locked versions refuse. */
export async function addSigner(input: { versionId: string; name: string; email: string }): Promise<
  ActionOk<{ ceremony: Ceremony; mail: MailSummary }> | ActionFail
> {
  const authed = await authedUser()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const confirmed = requireConfirmed(authed)
  if (confirmed) return confirmed
  const { supabase, userId } = authed

  const problem = validateRecipients([{ name: input.name, email: input.email }])
  if (problem) return { ok: false, error: problem }
  const rate = await checkInviteRate()
  if (rate) return rate
  const version = await ownedVersion(supabase, userId, input.versionId)
  if (!version) return { ok: false, error: "Document not found." }
  if (isLockedStatus(version.status)) return { ok: false, error: "Locked documents can't take new signers — redraft instead." }
  const existing = await versionSigners(supabase, version.id)
  if (existing.some((s) => s.email.toLowerCase() === input.email.trim().toLowerCase() && s.status !== "revoked")) {
    return { ok: false, error: "That email is already on this ceremony." }
  }
  const nextOrder = existing.reduce((m, s) => Math.max(m, s.sign_order ?? 0), 0) + 1
  // Late joiners inherit the ceremony deadline when one exists.
  const inheritedExpiry = existing.find((s) => s.expires_at)?.expires_at
    ?? expiryTimestamp(
      typeof version.signing_provenance?.expiresInDays === "number"
        ? (version.signing_provenance.expiresInDays as number)
        : 30
    )
  const token = randomBytes(24).toString("hex")
  const { error } = await supabase.from("document_signers").insert({
    audit_id: version.audit_id,
    document_type: version.document_type,
    document_version_id: version.id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    party_label: "signer",
    token,
    sign_order: nextOrder,
    expires_at: inheritedExpiry,
  })
  if (error) return { ok: false, error: "We couldn't add that signer. Please try again." }

  const mail: MailSummary = { emailed: [], needsCopy: [], gmailConnected: true }
  const { data: profile } = await supabase.from("business_profiles").select("business_name").eq("user_id", userId).maybeSingle()
  const fromName = ((profile as { business_name?: string | null } | null)?.business_name?.trim()) || authed.email.split("@")[0] || "Owner"
  const { data: audit } = await supabase.from("audits").select("title").eq("id", version.audit_id).eq("user_id", userId).maybeSingle()
  const dealTitle = ((audit as { title?: string | null } | null)?.title?.trim() ? (audit as { title: string }).title : "Untitled")
  try {
    const sent = await mailInvite(authed, dealTitle, version.document_type, { name: input.name.trim(), email: input.email.trim().toLowerCase(), token, expiresAt: inheritedExpiry }, fromName)
    if (sent) mail.emailed.push(input.email.trim().toLowerCase())
    else {
      mail.needsCopy.push(input.email.trim().toLowerCase())
      mail.gmailConnected = false
    }
  } catch {
    mail.needsCopy.push(input.email.trim().toLowerCase())
    mail.gmailConnected = false
  }
  return { ok: true, ceremony: await loadCeremony(supabase, userId, version), mail }
}

/** Re-send an invitation email for a pending (or lapsed-pending) invite. */
export async function resendSigner(input: { signerId: string }): Promise<
  ActionOk<{ mailed: boolean; reason: string | null }> | ActionFail
> {
  const authed = await authedUser()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const confirmed = requireConfirmed(authed)
  if (confirmed) return confirmed
  const { supabase, userId } = authed
  const rate = await checkInviteRate()
  if (rate) return rate

  const { data: signer } = await supabase
    .from("document_signers")
    .select("id, name, email, token, expires_at, status, document_version_id, party_label")
    .eq("id", input.signerId)
    .maybeSingle()
  const row = signer as { id: string; name: string; email: string; token: string; expires_at: string | null; status: string; document_version_id: string; party_label: string } | null
  if (!row) return { ok: false, error: "Signer not found." }
  const version = await ownedVersion(supabase, userId, row.document_version_id)
  if (!version) return { ok: false, error: "Document not found." }
  if (row.status !== "pending" && row.status !== "expired") {
    return { ok: false, error: "Only pending invitations can be re-sent." }
  }
  if (isLockedStatus(version.status)) return { ok: false, error: "Locked documents can't send invites." }

  const { data: profile } = await supabase.from("business_profiles").select("business_name").eq("user_id", userId).maybeSingle()
  const fromName = ((profile as { business_name?: string | null } | null)?.business_name?.trim()) || authed.email.split("@")[0] || "Owner"
  const { data: audit } = await supabase.from("audits").select("title").eq("id", version.audit_id).eq("user_id", userId).maybeSingle()
  const dealTitle = ((audit as { title?: string | null } | null)?.title?.trim() ? (audit as { title: string }).title : "Untitled")
  try {
    const sent = await mailInvite(authed, dealTitle, version.document_type, { name: row.name, email: row.email, token: row.token, expiresAt: row.expires_at }, fromName)
    if (!sent) return { ok: true, mailed: false, reason: "gmail_not_connected" }
    return { ok: true, mailed: true, reason: null }
  } catch (err) {
    return { ok: true, mailed: false, reason: err instanceof Error ? err.message : "Gmail send failed" }
  }
}

/** Revoke a pending (or lapsed) invitation. Signed rows are untouchable. */
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
  if (row.status !== "pending" && row.status !== "expired") {
    return { ok: false, error: "Only pending invitations can be revoked." }
  }
  const { error } = await supabase.from("document_signers").update({ status: "revoked" }).eq("id", row.id)
  if (error) return { ok: false, error: "We couldn't revoke that invitation." }
  const finalized = await maybeFinalize(supabase, userId, version)
  return { ok: true, ceremony: await loadCeremony(supabase, userId, finalized) }
}

/**
 * Reorder a pending counterparty one step earlier or later. Owner-only,
 * same-step signers move as a group edge: the row swaps with the nearest
 * pending row on the adjacent step. Locked versions refuse.
 */
export async function reorderSigner(input: { signerId: string; direction: "earlier" | "later" }): Promise<
  ActionOk<{ ceremony: Ceremony }> | ActionFail
> {
  const authed = await authedUser()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed

  const { data: signer } = await supabase
    .from("document_signers")
    .select("id, document_version_id, status, sign_order, party_label")
    .eq("id", input.signerId)
    .maybeSingle()
  const row = signer as { id: string; document_version_id: string; status: string; sign_order: number; party_label: string } | null
  if (!row) return { ok: false, error: "Signer not found." }
  if (row.party_label === "owner" || row.party_label === "Owner") {
    return { ok: false, error: "The owner always signs first — that step can't move." }
  }
  if (row.status !== "pending") return { ok: false, error: "Only pending invitations can be reordered." }
  const version = await ownedVersion(supabase, userId, row.document_version_id)
  if (!version) return { ok: false, error: "Document not found." }
  if (isLockedStatus(version.status)) return { ok: false, error: "Locked documents can't be reordered." }

  const signers = await versionSigners(supabase, version.id)
  const pending = signers
    .filter((s) => s.status === "pending" && s.party_label !== "owner" && s.party_label !== "Owner")
    .sort((a, b) => (a.sign_order - b.sign_order) || (a.created_at < b.created_at ? -1 : 1))
  const idx = pending.findIndex((s) => s.id === row.id)
  if (idx < 0) return { ok: false, error: "Signer not found." }
  const swapWith = input.direction === "earlier" ? pending[idx - 1] : pending[idx + 1]
  if (!swapWith || swapWith.sign_order === row.sign_order) {
    // Adjacent row on the same step (parallel group) or at the edge:
    // nudge this row alone instead of swapping identical steps.
    const delta = input.direction === "earlier" ? -1 : 1
    const target = Math.max(1, (row.sign_order ?? 1) + delta)
    if (target === row.sign_order) return { ok: false, error: "That step can't move further." }
    const { error } = await supabase.from("document_signers").update({ sign_order: target }).eq("id", row.id)
    if (error) return { ok: false, error: "We couldn't reorder that step." }
  } else {
    const { error: first } = await supabase.from("document_signers").update({ sign_order: swapWith.sign_order }).eq("id", row.id)
    if (first) return { ok: false, error: "We couldn't reorder that step." }
    const { error: second } = await supabase.from("document_signers").update({ sign_order: row.sign_order }).eq("id", swapWith.id)
    if (second) {
      await supabase.from("document_signers").update({ sign_order: row.sign_order }).eq("id", row.id)
      return { ok: false, error: "We couldn't reorder that step." }
    }
  }
  return { ok: true, ceremony: await loadCeremony(supabase, userId, version) }
}

/** Flip the ceremony's forwarding flag. Owner-only, any live version. */
export async function setAllowForward(input: { versionId: string; allow: boolean }): Promise<
  ActionOk<{ ceremony: Ceremony }> | ActionFail
> {
  const authed = await authedUser()
  if (!authed) return { ok: false, error: "You must be signed in." }
  const { supabase, userId } = authed
  const version = await ownedVersion(supabase, userId, input.versionId)
  if (!version) return { ok: false, error: "Document not found." }
  if (isLockedStatus(version.status)) return { ok: false, error: "Locked documents can't change forwarding." }
  const { error } = await supabase.from("document_versions").update({
    signing_provenance: { ...(version.signing_provenance ?? {}), allowForward: input.allow },
    updated_at: new Date().toISOString(),
  }).eq("id", version.id)
  if (error) return { ok: false, error: "We couldn't change forwarding." }
  return { ok: true, ceremony: await loadCeremony(supabase, userId, { ...version, signing_provenance: { ...(version.signing_provenance ?? {}), allowForward: input.allow } }) }
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
    ceremonies.push(await loadCeremony(supabase, userId, finalized))
  }
  return { ok: true, ceremonies }
}
