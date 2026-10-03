import type { SupabaseClient } from "@supabase/supabase-js"
import { getValidGmailTokens } from "@/lib/gmail/tokens"
import { sendGmailMessage } from "@/lib/gmail/api"

// Ceremony invitation email, sent from the owner's connected Gmail.
// Best-effort by design: the token link is always the source of truth
// (returned to the owner for copy/share), and a missing Gmail connection
// surfaces as a named reason — never a fabricated send.

export interface SignerInviteMail {
  to: string
  toName: string
  dealTitle: string
  familyTitle: string
  link: string
  expiresAt: string | null
  fromName: string
}

export type InviteMailResult = { sent: true } | { sent: false; reason: string }

function expiryLine(expiresAt: string | null): string {
  if (!expiresAt) return "This link stays open until the sender closes it."
  const d = new Date(expiresAt)
  const when = Number.isNaN(d.getTime())
    ? expiresAt
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  return `This link expires on ${when} — sign before then, or ask the sender for a fresh one.`
}

export async function sendSignerInviteEmail(
  client: SupabaseClient,
  userId: string,
  input: SignerInviteMail
): Promise<InviteMailResult> {
  let tokens
  try {
    tokens = await getValidGmailTokens(client, userId)
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "Gmail is unavailable" }
  }
  if (!tokens) return { sent: false, reason: "gmail_not_connected" }

  const body = [
    `Hi ${input.toName},`,
    "",
    `${input.fromName} invited you to review and sign "${input.dealTitle}" (${input.familyTitle}).`,
    "",
    input.link,
    "",
    expiryLine(input.expiresAt),
    "This link is personal to you — it only signs with your email address.",
    "No account needed.",
  ].join("\n")

  try {
    await sendGmailMessage(tokens.access_token, {
      to: input.to,
      subject: `${input.fromName} invited you to sign ${input.dealTitle}`,
      body,
    })
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "Gmail send failed" }
  }
  return { sent: true }
}
