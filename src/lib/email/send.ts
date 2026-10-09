// Transactional email via Resend (server-only).
//
// Fail-closed without RESEND_API_KEY: callers queue and log, never send.
// Templates live in react-email (portable MIT layer) so a future pipe
// swap is a one-file change, not a rewrite. Tracking stays off on
// transactional mail.

import { Resend } from "resend"

export function isEmailConfigured(): boolean {
  return (process.env.RESEND_API_KEY ?? "").trim().length > 0
}

function fromAddress(): string {
  const from = (process.env.EMAIL_FROM_ADDRESS ?? "").trim()
  if (!from) throw new Error("EMAIL_FROM_ADDRESS is not configured.")
  return from
}

export interface SendEmailInput {
  to: string
  subject: string
  react: React.ReactElement
  /** Idempotency key (schedule run id): safe retries never double-send. */
  idempotencyKey?: string
}

export interface SendEmailResult {
  messageId: string | null
}

/**
 * Sends one transactional email. Throws when unconfigured or rejected —
 * callers record the failure on the run history, never silently drop it.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = (process.env.RESEND_API_KEY ?? "").trim()
  if (!apiKey) throw new Error("Email is not configured (RESEND_API_KEY).")
  const email = (input.to ?? "").trim()
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
    throw new Error("Invalid recipient address.")
  }
  const subject = input.subject.trim().slice(0, 200)
  if (!subject) throw new Error("Email needs a subject.")
  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send(
    { from: fromAddress(), to: email, subject, react: input.react },
    ...(input.idempotencyKey ? [{ idempotencyKey: input.idempotencyKey } as never] : [])
  )
  if (error) throw new Error(error.message || "Email provider rejected the send.")
  return { messageId: typeof data?.id === "string" ? data.id : null }
}
