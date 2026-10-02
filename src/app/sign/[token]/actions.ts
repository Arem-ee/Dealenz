"use server"

import { headers } from "next/headers"
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
  }
}

async function callerIp(): Promise<string | null> {
  try {
    const h = await headers()
    const forwarded = h.get("x-forwarded-for")
    if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 45)
    return null
  } catch {
    return null
  }
}

export async function signTokenAction(input: { token: string; name: string; email: string }): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const name = input.name.trim()
  const email = input.email.trim()
  if (!name || !email) return { ok: false, error: "Type your name and confirm your email to sign." }
  const supabase = await createClient()
  const ip = await callerIp()
  const { data, error } = await supabase.rpc("sign_as_invitee", {
    p_token: input.token,
    p_name: name.slice(0, 120),
    p_email: email.slice(0, 254),
    p_ip: ip,
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
