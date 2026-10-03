import { createHash, randomBytes } from "node:crypto"
import { assertSigningTransition, type SigningStatus } from "@/lib/signing/transitions"

// Ceremony rules — pure. Owner signs first, counterparties follow in
// parallel by default (same step) or in ordered steps; completion is
// derived (no pending + at least one signed), never declared. No I/O,
// no clock reads except via explicit inputs.

export const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

// Invitation expiry bounds, in days. Mirrors the legacy invite route
// (1–120) so old and new ceremonies read identically.
export const EXPIRY_DAYS_DEFAULT = 30
export const EXPIRY_DAYS_MIN = 1
export const EXPIRY_DAYS_MAX = 120

/** Normalize an expiry-days input; null when out of bounds or malformed. */
export function normalizeExpiryDays(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return EXPIRY_DAYS_DEFAULT
  const n = typeof input === "string" ? Number(input) : input
  if (typeof n !== "number" || !Number.isInteger(n)) return null
  if (n < EXPIRY_DAYS_MIN || n > EXPIRY_DAYS_MAX) return null
  return n
}

/** Absolute expiry timestamp for an invitation sent now. */
export function expiryTimestamp(days: number, now: number = Date.now()): string {
  return new Date(now + days * 86_400_000).toISOString()
}

/**
 * Step numbers for counterparties, in recipient order. Parallel assigns
 * every counterparty to step 1 (all sign together after the owner);
 * sequential walks 1..n (each step unlocks when the previous signs).
 * The owner always holds step 0.
 */
export function assignSignOrder(count: number, sequential: boolean): number[] {
  return Array.from({ length: count }, (_, i) => (sequential ? i + 1 : 1))
}

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
  status: "pending" | "signed" | "declined" | "revoked" | "expired"
}

export function ceremonyProgress(signers: SignerState[]): { signed: number; total: number; complete: boolean; blocked: boolean } {
  // Expired invitations stay outstanding (never silently complete): the
  // owner resolves them by resending or revoking. Revoked resolved out.
  const active = signers.filter((s) => s.status === "signed" || s.status === "pending" || s.status === "expired")
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

export interface OrderedSignerState extends SignerState {
  signOrder: number
}

/** True when a pending signer on an earlier step blocks this signer. */
export function waitingOnEarlier(signers: OrderedSignerState[], signerId: string): boolean {
  const me = signers.find((s) => s.id === signerId)
  if (!me || me.status !== "pending") return false
  return signers.some((s) => s.status === "pending" && (s.signOrder ?? 0) < (me.signOrder ?? 0))
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
