"use server"

import { createClient } from "@/lib/supabase/server"
import { reportError } from "@/lib/logger"
import { transitionTarget } from "@/lib/review/transitions"
import { LAWYER_REQUEST_CREDITS } from "@/lib/credits/pricing"
import {
  finalizeReservation,
  reserveCredits,
  voidReservation,
  type LedgerClient,
} from "@/lib/credits/ledger"

type AutoAssignRow = { assigned: boolean; lawyer_id: string | null; message: string }

/**
 * Best-effort automatic matching on the caller's own request.
 * Never throws: every failure degrades to the stored manual state
 * (requested/waitlist), which keeps admin assignment as the exception path.
 */
async function tryAutoAssign(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  fromStatus: string,
  userId: string,
  auditId: string
): Promise<{ status: string; autoAssigned: boolean }> {
  // The state machine stays the single choke point: the system actor may
  // only perform "assign" from the same states an admin could.
  const allowed = transitionTarget("assign", fromStatus, "system")
  if (!allowed.ok) return { status: fromStatus, autoAssigned: false }
  let row: AutoAssignRow | null = null
  try {
    const { data, error } = await supabase.rpc("auto_assign_review", { p_request_id: requestId })
    if (error) throw error
    row = (Array.isArray(data) ? data[0] : data) as AutoAssignRow | null
  } catch (error) {
    // Matching infrastructure unavailable (e.g. migration not yet applied):
    // observable, but the request itself must survive.
    await reportError(supabase, {
      phase: "consultation_auto_assign",
      error,
      details: { step: "rpc", requestId },
      severity: "warn",
      userId,
      auditId,
    })
    return { status: fromStatus, autoAssigned: false }
  }
  if (row?.assigned) return { status: "matched", autoAssigned: true }
  if (row?.message === "no_eligible_lawyer" && fromStatus === "requested") {
    // Verified lawyers exist but none can safely take this deal (e.g. the
    // only verified profile belongs to the requester). Waitlist is the
    // truthful state; admin remains the exception path.
    await supabase
      .from("consultation_requests")
      .update({ status: "waitlist", updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("user_id", userId)
    return { status: "waitlist", autoAssigned: false }
  }
  return { status: fromStatus, autoAssigned: false }
}

export interface ConsultationResult {
  success: boolean
  status?: string
  autoAssigned?: boolean
  error?: string
}

export async function createConsultationRequest(auditId: string, note: string, handoffSnapshot?: Record<string, unknown> | null): Promise<ConsultationResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "You must be signed in to request a consultation" }
  }

  const { data: audit, error: auditError } = await supabase
    .from("audits")
    .select("id, user_id")
    .eq("id", auditId)
    .eq("user_id", user.id)
    .single()

  if (auditError || !audit) {
    return { success: false, error: "Deal not found." }
  }

  // Check if there's already a pending/active request for this audit
  const { data: existing } = await supabase
    .from("consultation_requests")
    .select("id")
    .eq("audit_id", auditId)
    .eq("user_id", user.id)
    .in("status", ["requested", "matched", "in_progress"])
    .maybeSingle()

  if (existing) {
    return { success: false, error: "You already have an active consultation request for this audit" }
  }

  // Check if there are any verified lawyers
  const { count: verifiedLawyersCount } = await supabase
    .from("lawyers")
    .select("*", { count: "exact", head: true })
    .eq("verification_status", "verified")

  const status = (verifiedLawyersCount ?? 0) > 0 ? "requested" : "waitlist"

  // Credit gate at the point of use: a lawyer request costs
  // LAWYER_REQUEST_CREDITS. Same balance check as every other billable
  // operation — never-purchased accounts cannot afford it. Deducted only
  // when the request is actually created.
  const ledger: LedgerClient = {
    rpc: async (functionName: string, args: Record<string, unknown> = {}) => {
      const result = await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
        functionName,
        args
      )
      return { data: result.data, error: result.error }
    },
  }
  let reservation: { allowed: boolean; reservationId: string | null }
  try {
    reservation = await reserveCredits(ledger, {
      operation: "document_analysis",
      amount: LAWYER_REQUEST_CREDITS,
      idempotencyKey: `consult:${auditId}:${crypto.randomUUID()}`,
    })
  } catch {
    return { success: false, error: "Could not verify credit balance. Please try again." }
  }
  if (!reservation.allowed || !reservation.reservationId) {
    return { success: false, error: `Insufficient credits for this operation. Lawyer requests cost ${LAWYER_REQUEST_CREDITS} credits.` }
  }
  const reservationId = reservation.reservationId

  const insertPayload: Record<string, unknown> = {
    audit_id: auditId,
    user_id: user.id,
    status,
    request_note: note,
  }
  if (handoffSnapshot !== undefined && handoffSnapshot !== null) {
    // Store structured handoff snapshot (founder/partnership) when provided; capped to ~100kb to avoid abuse
    try {
      const serialized = JSON.stringify(handoffSnapshot)
      if (serialized.length <= 100_000) {
        insertPayload.handoff_snapshot = handoffSnapshot
      }
    } catch {
      // Invalid snapshot — proceed without it rather than failing the request
    }
  }

  const settleSuccess = async () => {
    try {
      await finalizeReservation(ledger, {
        reservationId,
        consumptionAmount: LAWYER_REQUEST_CREDITS,
        operation: "document_analysis",
      })
    } catch (e) {
      // The request itself succeeded; a settlement failure must not rewrite
      // that outcome — it leaves a pending hold for ops to reconcile.
      await reportError(supabase, {
        phase: "consultation_settle",
        error: e,
        details: { step: "finalize", reservationId },
        severity: "error",
        userId: user.id,
        auditId,
      })
    }
  }

  const { data: created, error } = await supabase
    .from("consultation_requests")
    .insert(insertPayload)
    .select("id")
    .single<{ id: string }>()

  if (error) {
    // Fallback for DBs without handoff_snapshot column (pre-migration): retry without snapshot
    if (handoffSnapshot && error.message?.toLowerCase().includes("handoff_snapshot")) {
      const { data: retried, error: retryError } = await supabase
        .from("consultation_requests")
        .insert({
          audit_id: auditId,
          user_id: user.id,
          status,
          request_note: note,
        })
        .select("id")
        .single<{ id: string }>()
      if (retryError) {
        await reportError(supabase, {
          phase: "consultation_submit",
          error: retryError,
          details: { step: "insert_retry", status },
          severity: "error",
          userId: user.id,
          auditId,
        })
        await voidReservation(ledger, reservationId).catch(() => null)
        return { success: false, error: "We couldn't submit your review request. Please try again." }
      }
      const matched = await tryAutoAssign(supabase, retried.id, status, user.id, auditId)
      await settleSuccess()
      return { success: true, ...matched }
    }
    await reportError(supabase, {
      phase: "consultation_submit",
      error,
      details: { step: "insert", status },
      severity: "error",
      userId: user.id,
      auditId,
    })
    await voidReservation(ledger, reservationId).catch(() => null)
    return { success: false, error: "We couldn't submit your review request. Please try again." }
  }

  const matched = await tryAutoAssign(supabase, created.id, status, user.id, auditId)
  await settleSuccess()
  return { success: true, ...matched }
}

/**
 * Owner-triggered re-match for a request still awaiting assignment.
 * Covers the no-background-infrastructure gap: when a lawyer is verified
 * later, or a decliner frees the request, the owner (or admin exception
 * path) can retry matching without any job queue.
 */
export async function retryAutoAssignment(requestId: string): Promise<ConsultationResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "You must be signed in to retry matching" }

  const { data: request } = await supabase
    .from("consultation_requests")
    .select("id, audit_id, status")
    .eq("id", requestId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; audit_id: string; status: string }>()
  if (!request) return { success: false, error: "Review request not found." }
  const matched = await tryAutoAssign(supabase, request.id, request.status, user.id, request.audit_id)
  return { success: true, ...matched }
}

export async function getVerifiedLawyersCount() {
  const supabase = await createClient()
  const { count } = await supabase
    .from("lawyers")
    .select("*", { count: "exact", head: true })
    .eq("verification_status", "verified")
  return count ?? 0
}

export async function getConsultationRequest(auditId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  const { data, error } = await supabase
    .from("consultation_requests")
    .select("*")
    .eq("audit_id", auditId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, request: data }
}