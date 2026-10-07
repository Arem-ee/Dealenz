// Credit authorization orchestrator (Phase 5E).
//
// One economy for every AI operation: authorize before the provider call,
// measure actual usage, then finalize. Without a configured CreditPolicy the
// orchestrator runs in metering mode (usage recorded, nothing reserved or
// charged) so the boundary is real but no price is invented. With a policy,
// the full pre-flight flow applies: estimate, check, reserve, execute,
// measure, finalize. Findings and conclusions never pass through here, so
// credits cannot influence truth by construction.

import type { AIOperation } from "@/lib/ai/operations"
import { toUsageRecord, type AIUsageRecord, type AIOperationStatus, type CreditPolicy, type TokenUsage } from "@/lib/ai/usage"
import {
  finalizeReservation,
  getCreditBalance,
  reserveCredits,
  voidReservation,
  type LedgerClient,
} from "./ledger"

export interface AuthorizationRequest {
  ledger: LedgerClient
  userId: string
  operation: AIOperation
  // Caller-provided idempotency key (request ID, message ID). Required
  // whenever a policy is configured; optional in metering mode.
  idempotencyKey?: string
  policy?: CreditPolicy | null
  // User-text length for length-priced policies (conversation path).
  // Absent means price by operation alone.
  inputChars?: number
  // Billing scope: null spends personal balance, an org id spends the
  // pool (membership enforced in SQL). Resolved via resolveSpendScope.
  orgId?: string | null
}

export type AuthorizationMode = "metering" | "reserved" | "denied"

export interface Authorization {
  mode: AuthorizationMode
  authorized: boolean
  reservationId: string | null
  balance: number | null
  orgId: string | null
  denialReason?: string
}

export async function authorizeOperation(request: AuthorizationRequest): Promise<Authorization> {
  const orgId = request.orgId ?? null
  const balance = await getCreditBalance(request.ledger, orgId).catch(() => null)
  const estimate = request.policy ? request.policy.estimateMaxCredits(request.operation, request.inputChars) : null
  if (estimate === null) {
    // No priced policy: meter only. Nothing is held or charged.
    return { mode: "metering", authorized: true, reservationId: null, balance, orgId }
  }
  if (!request.idempotencyKey) {
    return { mode: "denied", authorized: false, reservationId: null, balance, orgId, denialReason: "Priced operations need an idempotency key" }
  }
  const reservation = await reserveCredits(request.ledger, {
    operation: request.operation,
    amount: estimate,
    idempotencyKey: request.idempotencyKey,
    orgId,
  })
  if (!reservation.allowed) {
    return {
      mode: "denied",
      authorized: false,
      reservationId: reservation.reservationId,
      balance: reservation.balance,
      orgId,
      denialReason: denialMessage(reservation.denyReason, orgId),
    }
  }
  return {
    mode: "reserved",
    authorized: true,
    reservationId: reservation.reservationId,
    balance: reservation.balance,
    orgId,
  }
}

function denialMessage(reason: string | null, orgId: string | null): string {
  if (reason === "cap_hit") {
    return "You hit your pool limit — ask an owner to raise it, or switch to solo balance."
  }
  if (reason === "not_member") {
    return "You're no longer in that pool — switched back to solo balance."
  }
  if (reason === "pool_empty" || orgId) {
    return "Insufficient pool balance for this operation — ask an owner to top up the pool."
  }
  return "Insufficient credits for this operation"
}

export interface CompletionInput {
  ledger: LedgerClient
  authorization: Authorization
  operation: AIOperation
  provider?: string
  model?: string
  usage?: TokenUsage
  status: AIOperationStatus
  policy?: CreditPolicy | null
  // Mirrors the authorization's inputChars so estimate and charge agree.
  inputChars?: number
}

export interface Completion {
  record: AIUsageRecord
  balance: number | null
}

// Completes one authorized operation: builds the usage record, converts
// measured tokens to a charge only when a policy exists, settles the
// reservation, and returns the record plus the resulting balance. Failures
// release the hold without charge; the failure status stays on the record so
// policy can distinguish provider usage from product outcome later.
export async function completeOperation(input: CompletionInput): Promise<Completion> {
  const record = toUsageRecord({
    operation: input.operation,
    provider: input.provider ?? "unattributed",
    model: input.model ?? "unattributed",
    usage: input.usage,
    status: input.status,
    inputChars: input.inputChars,
  })
  if (input.authorization.mode !== "reserved" || !input.authorization.reservationId) {
    return { record, balance: input.authorization.balance }
  }
  if (input.status !== "success") {
    await voidReservation(input.ledger, input.authorization.reservationId)
    const balance = await getCreditBalance(input.ledger, input.authorization.orgId ?? null).catch(() => null)
    return { record, balance }
  }
  const charge = input.policy ? input.policy.creditsForUsage(record) : null
  const finalized = await finalizeReservation(input.ledger, {
    reservationId: input.authorization.reservationId,
    consumptionAmount: charge,
    operation: input.operation,
  })
  return { record: { ...record, creditsConsumed: charge }, balance: finalized.balance }
}
