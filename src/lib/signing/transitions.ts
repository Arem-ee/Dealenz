// Signing lifecycle state machine (Phase 3)
// draft -> ready_to_sign -> owner_signed -> counterparty_pending -> fully_signed -> locked
// Legacy ready_to_send/sent map to ready_to_sign/counterparty_pending for compat.
// superseded is terminal after redraft.
// owner_signed NEVER transitions directly to fully_signed: execution requires
// every counterparty signature (enforced here, in the DB trigger, and by the
// RPC signer-count check). All transitions are explicit, server-validated,
// never client-invented.

export type SigningStatus =
  | "draft"
  | "ready_to_sign"
  | "ready_to_send" // legacy compat, treated as ready_to_sign
  | "owner_signed"
  | "counterparty_pending"
  | "sent" // legacy compat, treated as counterparty_pending
  | "fully_signed"
  | "locked"
  | "superseded"

export const SIGNING_TRANSITIONS: Record<SigningStatus, SigningStatus[]> = {
  draft: ["ready_to_sign", "ready_to_send"],
  ready_to_sign: ["owner_signed"],
  ready_to_send: ["owner_signed"],
  owner_signed: ["counterparty_pending", "sent"],
  counterparty_pending: ["fully_signed", "locked"],
  sent: ["fully_signed", "locked"],
  fully_signed: ["locked"],
  locked: ["superseded"],
  superseded: [],
}

export function canTransitionSigning(from: SigningStatus, to: SigningStatus): boolean {
  return (SIGNING_TRANSITIONS[from] ?? []).includes(to)
}

export function assertSigningTransition(from: SigningStatus, to: SigningStatus) {
  if (!canTransitionSigning(from, to)) throw new Error(`Invalid signing transition ${from} -> ${to}`)
}

export function normalizeSigningStatus(s: string): SigningStatus {
  if (s === "ready_to_send") return "ready_to_sign"
  if (s === "sent") return "counterparty_pending"
  return s as SigningStatus
}

export function isLockedStatus(s: string): boolean {
  return s === "locked" || s === "fully_signed" || s === "superseded"
}

export function requiresOwnerApproval(s: SigningStatus): boolean {
  return s === "draft" || s === "ready_to_sign"
}
