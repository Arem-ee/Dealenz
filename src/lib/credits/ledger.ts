// Credit ledger client (Phase 5E).
//
// Append-mostly ledger over the credit_ledger table (migration 00023).
// Users can read their own rows; all writes go through SECURITY DEFINER RPCs
// (same convention as increment_usage), so no browser or ordinary session can
// grant, consume, refund, or rewrite history directly. Amounts are signed
// integers: grants, refunds, and positive adjustments add; consumptions and
// open reservations subtract. Reservations move pending to finalized (on
// consumption) or voided (on failure) only inside the RPCs; rows are never
// deleted and voided rows stay readable for audit.

import type { AIOperation } from "@/lib/ai/operations"

export type LedgerEntryType = "grant" | "reservation" | "consumption" | "refund" | "adjustment"

export type LedgerEntryStatus = "pending" | "finalized" | "voided"

export interface LedgerEntry {
  id: string
  userId: string
  entryType: LedgerEntryType
  // Signed credits. Never zero.
  amount: number
  operation: AIOperation | null
  status: LedgerEntryStatus
  idempotencyKey: string | null
  relatedEntryId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface LedgerClient {
  rpc(functionName: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

// Current available balance for the caller: finalized grants, refunds, and
// adjustments minus consumptions and open (pending) reservations. Voided rows
// never count. The RPC derives the user from the session; there is no
// user-id parameter to tamper with.
export async function getCreditBalance(client: LedgerClient): Promise<number> {
  const { data, error } = await client.rpc("credit_balance")
  if (error) throw new Error("Failed to read credit balance")
  const row = Array.isArray(data) ? data[0] : data
  const record = asRecord(row)
  const balance = record ? record.balance : undefined
  if (typeof balance !== "number" || !Number.isFinite(balance)) {
    throw new Error("Failed to read credit balance")
  }
  return Math.floor(balance)
}

export interface ReservationResult {
  allowed: boolean
  balance: number
  reservationId: string | null
}

// Holds amount credits for one billable operation. Idempotent on
// idempotencyKey: replaying the same key returns the original outcome without
// a second hold. Denied when the available balance is insufficient.
export async function reserveCredits(
  client: LedgerClient,
  input: { operation: AIOperation; amount: number; idempotencyKey: string }
): Promise<ReservationResult> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Reservation amount must be a positive integer")
  }
  if (!input.idempotencyKey || input.idempotencyKey.length > 120) {
    throw new Error("Reservation needs an idempotency key (max 120 chars)")
  }
  const { data, error } = await client.rpc("reserve_credits", {
    p_operation: input.operation,
    p_amount: input.amount,
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) throw new Error("Failed to reserve credits")
  const row = asRecord(Array.isArray(data) ? data[0] : data)
  if (!row || typeof row.allowed !== "boolean" || typeof row.balance !== "number") {
    throw new Error("Failed to reserve credits")
  }
  return {
    allowed: row.allowed,
    balance: Math.floor(row.balance),
    reservationId: typeof row.reservation_id === "string" ? row.reservation_id : null,
  }
}

// Settles a pending reservation: voids the hold and records the measured
// consumption (which may be lower than reserved). A null consumption records
// usage metering without charge and still releases the hold.
export async function finalizeReservation(
  client: LedgerClient,
  input: { reservationId: string; consumptionAmount: number | null; operation: AIOperation }
): Promise<{ balance: number }> {
  if (input.consumptionAmount !== null && (!Number.isInteger(input.consumptionAmount) || input.consumptionAmount < 0)) {
    throw new Error("Consumption amount must be a non-negative integer or null")
  }
  const { data, error } = await client.rpc("finalize_reservation", {
    p_reservation_id: input.reservationId,
    p_consumption_amount: input.consumptionAmount,
    p_operation: input.operation,
  })
  if (error) throw new Error("Failed to finalize credit reservation")
  const row = asRecord(Array.isArray(data) ? data[0] : data)
  if (!row || typeof row.balance !== "number") throw new Error("Failed to finalize credit reservation")
  return { balance: Math.floor(row.balance) }
}

// Releases a pending hold after a failed operation. No charge is recorded;
// the failure itself is represented in the AIUsageRecord, not the ledger.
export async function voidReservation(client: LedgerClient, reservationId: string): Promise<void> {
  const { error } = await client.rpc("void_reservation", { p_reservation_id: reservationId })
  if (error) throw new Error("Failed to release credit reservation")
}

export interface StepConsumptionResult {
  consumedTotal: number
  remaining: number
}

// Settles one succeeded step's measured cost against a pending plan
// reservation immediately (incremental deduction). Idempotent per stepKey:
// replays return current totals without a second charge, and the running
// total can never exceed the reserved amount. The reservation stays pending;
// final settlement still goes through finalizeReservation for the remainder.
export async function consumeReservationStep(
  client: LedgerClient,
  input: { reservationId: string; stepKey: string; amount: number }
): Promise<StepConsumptionResult> {
  if (!Number.isInteger(input.amount) || input.amount < 0) {
    throw new Error("Step consumption amount must be a non-negative integer")
  }
  if (!input.stepKey || input.stepKey.length > 78) {
    throw new Error("Step key is required (max 78 chars)")
  }
  const { data, error } = await client.rpc("consume_reservation_step", {
    p_reservation_id: input.reservationId,
    p_step_key: input.stepKey,
    p_amount: input.amount,
  })
  if (error) throw new Error("Failed to record step consumption")
  const row = asRecord(Array.isArray(data) ? data[0] : data)
  if (!row || typeof row.consumed_total !== "number" || typeof row.remaining !== "number") {
    throw new Error("Failed to record step consumption")
  }
  return { consumedTotal: row.consumed_total, remaining: row.remaining }
}
