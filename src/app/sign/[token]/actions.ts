"use server"

import { createClient } from "@/lib/supabase/server"

const TOKEN_RE = /^[A-Za-z0-9_-]{10,200}$/
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export interface SignerView {
  signerName: string
  signerEmail: string
  partyLabel: string
  signStatus: string
  signedAt: string | null
  documentType: string
  versionNumber: number
  content: string
  superseded: boolean
  totalSigners: number
  signedSigners: number
}

/** Token-gated read: no account, no deal access beyond this invitation. */
export async function getInviteeView(token: string): Promise<{ found: boolean; view?: SignerView }> {
  if (!TOKEN_RE.test(token)) return { found: false }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_signer_view", { p_token: token })
  if (error || !data) return { found: false }
  const rows = (Array.isArray(data) ? data : [data]) as Array<Record<string, unknown>>
  const row = rows[0]
  if (!row || typeof row.content !== "string") return { found: false }
  return {
    found: true,
    view: {
      signerName: String(row.signer_name ?? ""),
      signerEmail: String(row.signer_email ?? ""),
      partyLabel: String(row.party_label ?? "signer"),
      signStatus: String(row.sign_status ?? "pending"),
      signedAt: typeof row.signed_at === "string" ? row.signed_at : null,
      documentType: String(row.document_type ?? ""),
      versionNumber: typeof row.version_number === "number" ? row.version_number : 0,
      content: row.content as string,
      superseded: row.superseded === true,
      totalSigners: typeof row.total_signers === "number" ? row.total_signers : 1,
      signedSigners: typeof row.signed_signers === "number" ? row.signed_signers : 0,
    },
  }
}

/** Token-gated signing: the invitee proves nothing but token possession plus
 * matching name/email. The RPC binds the exact version and rejects
 * superseded, duplicate, revoked, or declined invitations server-side. */
export async function signInviteeDocument(token: string, name: string, email: string) {
  if (!TOKEN_RE.test(token)) return { success: false, error: "Invalid signing link" }
  const cleanName = typeof name === "string" ? name.trim() : ""
  const cleanEmail = typeof email === "string" ? email.trim() : ""
  if (!cleanName || cleanName.length > 120) return { success: false, error: "Enter your full name" }
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) {
    return { success: false, error: "Enter a valid email address" }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("sign_as_invitee", {
    p_token: token,
    p_name: cleanName,
    p_email: cleanEmail,
  })
  if (error) return { success: false, error: "Signing failed. Please try again." }
  const rows = (Array.isArray(data) ? data : [data]) as Array<{ success: boolean; message: string }>
  const result = rows[0]
  if (!result?.success) return { success: false, error: result?.message ?? "Signing failed" }
  return { success: true }
}

export async function declineInviteeDocument(token: string) {
  if (!TOKEN_RE.test(token)) return { success: false, error: "Invalid signing link" }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("decline_as_invitee", { p_token: token })
  if (error) return { success: false, error: "Request failed. Please try again." }
  const rows = (Array.isArray(data) ? data : [data]) as Array<{ success: boolean; message: string }>
  const result = rows[0]
  if (!result?.success) return { success: false, error: result?.message ?? "Request failed" }
  return { success: true }
}
