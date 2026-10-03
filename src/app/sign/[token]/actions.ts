"use server"

import { createClient } from "@/lib/supabase/server"

export interface SignerViewState {
  name: string
  email: string
  partyLabel: string
  status: string
  signedAt: string | null
  documentType: string
  versionNumber: number
  content: string
  superseded: boolean
  totalSigners: number
  signedSigners: number
  expiresAt: string | null
  signOrder: number
  earlierPending: number
  allowForward: boolean
}

/** Public invitee view: token-gated RPC, no account. Null when invalid. */
export async function getSignerView(token: string): Promise<SignerViewState | null> {
  if (!token || token.length > 200) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_signer_view", { p_token: token })
  if (error || !data) return null
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined
  if (!row || typeof row.content !== "string") return null
  return {
    name: typeof row.signer_name === "string" ? row.signer_name : "",
    email: typeof row.signer_email === "string" ? row.signer_email : "",
    partyLabel: typeof row.party_label === "string" ? row.party_label : "signer",
    status: typeof row.sign_status === "string" ? row.sign_status : "pending",
    signedAt: typeof row.signed_at === "string" ? row.signed_at : null,
    documentType: typeof row.document_type === "string" ? row.document_type : "",
    versionNumber: typeof row.version_number === "number" ? row.version_number : 0,
    content: row.content,
    superseded: row.superseded === true,
    totalSigners: typeof row.total_signers === "number" ? row.total_signers : 0,
    signedSigners: typeof row.signed_signers === "number" ? row.signed_signers : 0,
    // Added by 00094; older deployments return undefined — treat as open.
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
    signOrder: typeof row.sign_order === "number" ? row.sign_order : 0,
    earlierPending: typeof row.earlier_pending === "number" ? row.earlier_pending : 0,
    // Added by 00094; older deployments return undefined — default allowed,
    // and the forward_invite RPC enforces the real flag server-side anyway.
    allowForward: row.allow_forward !== false,
  }
}

export async function signTokenAction(input: {
  token: string
  name: string
  email: string
  consent: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = input.name.trim()
  const email = input.email.trim()
  if (!name || !email) return { ok: false, error: "Type your name and confirm your email to sign." }
  if (input.consent !== true) {
    return { ok: false, error: "Confirm you agree to sign electronically first." }
  }
  const supabase = await createClient()
  // NOTE: sign_as_invitee takes (p_token, p_name, p_email) only — no p_ip.
  // Passing unknown arguments makes PostgREST reject the call.
  const { data, error } = await supabase.rpc("sign_as_invitee", {
    p_token: input.token,
    p_name: name.slice(0, 120),
    p_email: email.slice(0, 254),
  })
  if (error) return { ok: false, error: "We couldn't record that signature. Please try again." }
  const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
  if (!row?.success) return { ok: false, error: row?.message || "That signing link is no longer valid." }
  return { ok: true }
}

export async function declineTokenAction(input: { token: string }): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("decline_as_invitee", { p_token: input.token })
  if (error) return { ok: false, error: "We couldn't record that. Please try again." }
  const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
  if (!row?.success) return { ok: false, error: row?.message || "That signing link is no longer valid." }
  return { ok: true }
}

/**
 * Artifact-first invitee image: shape-validated in the app, token- and
 * email-verified in the RPC. The sign call follows only on success, so a
 * recorded invitee signature always carries its drawn or typed image.
 */
export async function saveArtifactAction(input: {
  token: string
  email: string
  imageData: string
  method: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { validateSignatureArtifact } = await import("@/lib/signatures/validate")
  const valid = validateSignatureArtifact({ imageData: input.imageData, method: input.method })
  if (!valid.ok) return { ok: false, error: valid.error }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("save_signature_artifact", {
    p_token: input.token,
    p_email: input.email.trim().slice(0, 254),
    p_image_data: valid.imageData,
    p_method: valid.method,
  })
  if (error) return { ok: false, error: "We couldn't save that signature. Please try again." }
  const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
  if (!row?.success) return { ok: false, error: row?.message || "That signing link is no longer valid." }
  return { ok: true }
}

export async function forwardTokenAction(input: {
  token: string
  name: string
  email: string
}): Promise<{ ok: true; newToken: string } | { ok: false; error: string }> {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name || name.length > 120) return { ok: false, error: "Enter the colleague's full name." }
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
    return { ok: false, error: "Enter a valid email for the colleague." }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("forward_invite", {
    p_token: input.token,
    p_name: name.slice(0, 120),
    p_email: email.slice(0, 254),
  })
  if (error) return { ok: false, error: "We couldn't forward that invitation. Please try again." }
  const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string; new_token?: string } | null
  if (!row?.success || !row.new_token) {
    return { ok: false, error: row?.message || "That signing link is no longer valid." }
  }
  return { ok: true, newToken: row.new_token }
}
