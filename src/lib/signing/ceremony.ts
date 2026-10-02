import { createHash, randomBytes } from "node:crypto"
import { assertSigningTransition, type SigningStatus } from "@/lib/signing/transitions"

// Ceremony rules — pure. Owner signs first, counterparties follow in
// parallel; completion is derived (no pending + at least one signed),
// never declared. No I/O, no clock reads except via explicit inputs.

export const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export interface RecipientInput {
  name: string
  email: string
}

export function validateRecipients(recipients: RecipientInput[]): string | null {
  if (recipients.length > 20) return "Ceremonies hold at most 20 counterparties."
  const seen = new Set<string>()
  for (const r of recipients) {
    const name = r.name.trim()
    const email = r.email.trim().toLowerCase()
    if (!name || name.length > 120) return "Every counterparty needs a name (1–120 characters)."
    if (!EMAIL_RE.test(email)) return `“${r.email.trim() || "blank"}” is not a valid email.`
    if (seen.has(email)) return `“${r.email.trim()}” is listed twice.`
    seen.add(email)
  }
  return null
}

export function mintSignerToken(): string {
  return randomBytes(24).toString("hex")
}

export interface SignerState {
  id: string
  isOwner: boolean
  status: "pending" | "signed" | "declined" | "revoked"
}

export function ceremonyProgress(signers: SignerState[]): { signed: number; total: number; complete: boolean; blocked: boolean } {
  const active = signers.filter((s) => s.status === "signed" || s.status === "pending")
  const signed = active.filter((s) => s.status === "signed").length
  const total = active.length
  const declined = signers.some((s) => s.status === "declined")
  return {
    signed,
    total,
    complete: total > 0 && signed === total && !declined,
    blocked: declined,
  }
}

/**
 * Next version status after a signature lands. Returns null when the
 * version status must not move. Owner-first is enforced by call order
 * (owner signs before invites go out), not by this function.
 */
export function advanceAfterSign(
  versionStatus: SigningStatus,
  progress: { signed: number; total: number; complete: boolean }
): SigningStatus | null {
  if (!progress.complete) {
    if (versionStatus === "ready_to_sign" || versionStatus === "ready_to_send") return "owner_signed"
    if (versionStatus === "owner_signed") return "counterparty_pending"
    return null
  }
  if (versionStatus === "counterparty_pending" || versionStatus === "sent" || versionStatus === "owner_signed") {
    return "fully_signed"
  }
  return null
}

export function assertCeremonyTransition(from: SigningStatus, to: SigningStatus): void {
  assertSigningTransition(from, to)
}

export function sealContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex")
}
