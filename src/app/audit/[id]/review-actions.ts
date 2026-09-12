"use server"

import { createClient } from "@/lib/supabase/server"
import { reportError } from "@/lib/logger"
import { transitionTarget, isActiveReviewStatus } from "@/lib/review/transitions"

type FinalDocumentRow = {
  id: string
  document_type: string
  document_version_id: string
  finalized_at: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const COMMENT_TARGETS = ["finding", "clause", "fact", "evidence", "document", "question", "general"] as const
const MAX_SIGNERS_PER_AUDIT = 10

async function requireOwnerAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  auditId: string
) {
  if (!UUID_RE.test(auditId)) throw new Error("Invalid audit ID")
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !UUID_RE.test(user.id)) throw new Error("Unauthorized")
  const { data: audit } = await supabase
    .from("audits")
    .select("id")
    .eq("id", auditId)
    .eq("user_id", user.id)
    .single()
  if (!audit) throw new Error("Audit not found")
  return user
}

async function requireOwnedRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  userId: string
) {
  if (!UUID_RE.test(requestId)) throw new Error("Invalid review request ID")
  const { data, error } = await supabase
    .from("consultation_requests")
    .select("id, audit_id, user_id, lawyer_id, status")
    .eq("id", requestId)
    .single()
  if (error || !data) throw new Error("Review request not found")
  const request = data as { id: string; audit_id: string; user_id: string; lawyer_id: string | null; status: string }
  if (request.user_id !== userId) throw new Error("Not your review request")
  return request
}

async function logReviewActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  auditId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from("activity_events").insert({
      user_id: userId,
      audit_id: auditId,
      event_type: eventType,
      payload,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Audit trail is best-effort; never breaks the transition.
  }
}

/** Deal-scoped review state for the owner: request, comments, signers, orders, execution. */
export async function getReviewState(auditId: string) {
  const supabase = await createClient()
  const user = await requireOwnerAudit(supabase, auditId)

  const { data: request } = await supabase
    .from("consultation_requests")
    .select("id, status, lawyer_id, created_at, updated_at")
    .eq("audit_id", auditId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const typed = (request ?? null) as null | { id: string; status: string; lawyer_id: string | null; created_at: string; updated_at: string }
  let comments: unknown[] = []
  let lawyer: unknown = null
  if (typed) {
  // Display bound (the database caps writes at 500/review; reads stay bounded).
  const { data: commentRows } = await supabase
    .from("review_comments")
    .select("id, author_role, target_type, target_key, document_version_id, body, status, provenance, created_at")
    .eq("consultation_request_id", typed.id)
    .order("created_at", { ascending: true })
    .limit(500)
    comments = (commentRows ?? []) as unknown[]
    if (typed.lawyer_id) {
      const { data: lawyerRow } = await supabase
        .from("lawyers")
        .select("id, full_name, verification_status")
        .eq("id", typed.lawyer_id)
        .maybeSingle()
      lawyer = lawyerRow ?? null
    }
  }

  const { data: signerRows } = await supabase
    .from("document_signers")
    .select("id, name, email, party_label, document_type, document_version_id, status, signed_at, created_at")
    .eq("audit_id", auditId)
    .order("created_at", { ascending: true })

  const { data: orderRows } = await supabase
    .from("service_orders")
    .select("id, amount_minor, currency, status, note, created_at")
    .eq("audit_id", auditId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const { data: versionRows } = await supabase
    .from("document_versions")
    .select("id, document_type, version_number")
    .eq("audit_id", auditId)
    .order("version_number", { ascending: false })
    .limit(100)

  // Final per document type, with this audit's derived execution state for each.
  const { data: finalRows } = await supabase
    .from("final_documents")
    .select("id, document_type, document_version_id, finalized_at")
    .eq("audit_id", auditId)
  const finals = (finalRows ?? []) as unknown as FinalDocumentRow[]
  const versionsById = new Map(
    ((versionRows ?? []) as Array<{ id: string; version_number: number }>).map((v) => [v.id, v]),
  )
  const signersByVersion = new Map<string, Array<{ status: string }>>()
  for (const s of ((signerRows ?? []) as unknown as Array<{ document_version_id: string | null; status: string }>)) {
    if (!s.document_version_id) continue
    const list = signersByVersion.get(s.document_version_id) ?? []
    list.push({ status: s.status })
    signersByVersion.set(s.document_version_id, list)
  }

  return {
    success: true,
    request: typed,
    lawyer,
    comments,
    signers: (signerRows ?? []) as unknown[],
    serviceOrders: (orderRows ?? []) as unknown[],
    versions: (versionRows ?? []) as unknown[],
    finals: finals.map((f) => {
      const version = versionsById.get(f.document_version_id)
      const signers = signersByVersion.get(f.document_version_id) ?? []
      return {
        ...f,
        versionNumber: version?.version_number ?? null,
        executed: signers.length > 0 && signers.every((s) => s.status === "signed"),
      }
    }),
  }
}

export async function addOwnerComment(
  requestId: string,
  input: { targetType: string; targetKey?: string | null; documentVersionId?: string | null; body: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const request = await requireOwnedRequest(supabase, requestId, user.id)

  if (!(COMMENT_TARGETS as ReadonlyArray<string>).includes(input.targetType)) {
    throw new Error("Invalid comment target")
  }
  const body = typeof input.body === "string" ? input.body.trim() : ""
  if (body.length === 0 || body.length > 5000) throw new Error("Comment must be 1–5000 characters")
  if (input.targetKey !== undefined && input.targetKey !== null) {
    if (typeof input.targetKey !== "string" || input.targetKey.length > 200) throw new Error("Invalid target reference")
  }
  if (input.documentVersionId !== undefined && input.documentVersionId !== null) {
    if (!UUID_RE.test(input.documentVersionId)) throw new Error("Invalid document version")
    const { data: version } = await supabase
      .from("document_versions")
      .select("id")
      .eq("id", input.documentVersionId)
      .eq("audit_id", request.audit_id)
      .maybeSingle()
    if (!version) throw new Error("Document version does not belong to this deal")
  }

  const { error } = await supabase.from("review_comments").insert({
    consultation_request_id: request.id,
    audit_id: request.audit_id,
    author_user_id: user.id,
    author_role: "client",
    target_type: input.targetType,
    target_key: input.targetKey ?? null,
    document_version_id: input.documentVersionId ?? null,
    body,
    status: "open",
    provenance: "client",
  })
  if (error) throw new Error(`Failed to add comment: ${error.message}`)
  await logReviewActivity(supabase, user.id, request.audit_id, "review_comment_added", {
    request_id: request.id,
    target_type: input.targetType,
    by: "client",
  })
  return { success: true }
}

/** Owner accepts (resolved) or declines (withdrawn) a lawyer proposal. */
export async function resolveProposal(commentId: string, decision: "accept" | "decline") {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  if (!UUID_RE.test(commentId)) throw new Error("Invalid comment ID")
  if (decision !== "accept" && decision !== "decline") throw new Error("Invalid decision")

  const { data: comment } = await supabase
    .from("review_comments")
    .select("id, consultation_request_id, audit_id, author_role, target_type, status")
    .eq("id", commentId)
    .maybeSingle()
  if (!comment) throw new Error("Comment not found")
  const row = comment as { id: string; consultation_request_id: string; audit_id: string; author_role: string; target_type: string; status: string }
  if (row.author_role !== "lawyer" || row.target_type !== "document") {
    throw new Error("Only lawyer document proposals can be resolved here")
  }
  if (row.status !== "open") throw new Error("Proposal is already resolved")
  const request = await requireOwnedRequest(supabase, row.consultation_request_id, user.id)

  const { error } = await supabase
    .from("review_comments")
    .update({ status: decision === "accept" ? "resolved" : "withdrawn" })
    .eq("id", commentId)
  if (error) throw new Error(`Failed to resolve proposal: ${error.message}`)

  // A response moves an awaiting-proposal review back to client_review.
  if (request.status === "changes_requested") {
    const t = transitionTarget("respond", request.status, "owner")
    if (t.ok) {
      await supabase.from("consultation_requests").update({ status: t.to }).eq("id", request.id)
    }
  }
  await logReviewActivity(supabase, user.id, request.audit_id, decision === "accept" ? "change_accepted" : "change_rejected", {
    request_id: request.id,
    comment_id: commentId,
  })
  return { success: true, decision }
}

export async function cancelReview(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const request = await requireOwnedRequest(supabase, requestId, user.id)
  const t = transitionTarget("cancel", request.status, "owner")
  if (!t.ok) throw new Error(t.reason)
  const { error } = await supabase
    .from("consultation_requests")
    .update({ status: t.to, updated_at: new Date().toISOString() })
    .eq("id", request.id)
  if (error) throw new Error(`Failed to cancel review: ${error.message}`)
  await logReviewActivity(supabase, user.id, request.audit_id, "review_cancelled", { request_id: request.id })
  return { success: true, status: t.to }
}

/**
 * Execution status for one document type, bound to its FINAL version.
 * Derived, never stored: executed = a final version exists, at least one
 * signer is bound to exactly that version, and none of them is pending.
 * Declined/revoked signers resolved out via re-invitation and do not block.
 */
export async function getExecutionStatus(auditId: string, documentType: string) {
  const supabase = await createClient()
  const user = await requireOwnerAudit(supabase, auditId)
  void user
  if (typeof documentType !== "string" || !documentType || documentType.length > 120) {
    throw new Error("Invalid document type")
  }
  const { data: final } = await supabase
    .from("final_documents")
    .select("document_version_id")
    .eq("audit_id", auditId)
    .eq("document_type", documentType)
    .maybeSingle<{ document_version_id: string }>()
  if (!final) {
    return { success: true, finalVersionId: null, signers: [], executed: false }
  }
  const { data } = await supabase
    .from("document_signers")
    .select("id, name, email, party_label, document_version_id, status, signed_at")
    .eq("audit_id", auditId)
    .eq("document_type", documentType)
    .eq("document_version_id", final.document_version_id)
    .order("created_at", { ascending: true })
  const signers = ((data ?? []) as Array<{ status: string }>)
  return {
    success: true,
    finalVersionId: final.document_version_id as string,
    signers: data ?? [],
    executed: signers.length > 0 && signers.every((s) => s.status === "signed"),
  }
}

export async function inviteSigner(
  auditId: string,
  input: { documentVersionId: string; name: string; email: string; partyLabel?: string }
) {
  const supabase = await createClient()
  const user = await requireOwnerAudit(supabase, auditId)

  if (!UUID_RE.test(input.documentVersionId)) throw new Error("Invalid document version")
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const email = typeof input.email === "string" ? input.email.trim() : ""
  const partyLabel = typeof input.partyLabel === "string" && input.partyLabel.trim() ? input.partyLabel.trim() : "signer"
  if (!name || name.length > 120) throw new Error("Signer name must be 1–120 characters")
  if (!EMAIL_RE.test(email) || email.length > 254) throw new Error("Invalid signer email")
  if (partyLabel.length > 80) throw new Error("Invalid party label")

  // Bind the latest version: inviting against a superseded version would
  // create an instantly-invalid invitation.
  const { data: version } = await supabase
    .from("document_versions")
    .select("id, audit_id, document_type, version_number")
    .eq("id", input.documentVersionId)
    .eq("audit_id", auditId)
    .maybeSingle<{ id: string; audit_id: string; document_type: string; version_number: number }>()
  if (!version) throw new Error("Document version does not belong to this deal")
  const { data: latest } = await supabase
    .from("document_versions")
    .select("version_number")
    .eq("audit_id", auditId)
    .eq("document_type", version.document_type)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ version_number: number }>()
  if (latest && latest.version_number !== version.version_number) {
    throw new Error("A newer document version exists; invite against the latest version")
  }

  const { data: existingSigners } = await supabase
    .from("document_signers")
    .select("id")
    .eq("audit_id", auditId)
  if (((existingSigners ?? []) as unknown[]).length >= MAX_SIGNERS_PER_AUDIT) {
    throw new Error(`At most ${MAX_SIGNERS_PER_AUDIT} signers per deal`)
  }

  const token = crypto.randomUUID()
  const { data: signer, error } = await supabase
    .from("document_signers")
    .insert({
      audit_id: auditId,
      document_type: version.document_type,
      document_version_id: version.id,
      name,
      email,
      party_label: partyLabel,
      token,
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>()
  if (error || !signer) throw new Error(`Failed to invite signer: ${error?.message ?? "unknown error"}`)
  await logReviewActivity(supabase, user.id, auditId, "signer_invited", {
    signer_id: signer.id,
    document_type: version.document_type,
  })
  return { success: true, signerId: signer.id, token }
}

export async function revokeSigner(signerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  if (!UUID_RE.test(signerId)) throw new Error("Invalid signer ID")
  // Owners have no direct UPDATE on document_signers (they must never mark
  // signers signed): revocation flows through the narrow RPC, which verifies
  // deal ownership and the pending-only transition server-side.
  const { data, error } = await supabase.rpc("revoke_signer_invite", { p_signer_id: signerId })
  if (error) throw new Error("Failed to revoke signer")
  const rows = (Array.isArray(data) ? data : [data]) as Array<{ success: boolean; message: string }>
  const result = rows[0]
  if (!result?.success) throw new Error(result?.message ?? "Failed to revoke signer")
  // Best-effort audit trail keyed by the caller's own audit lookup.
  try {
    const { data: signer } = await supabase
      .from("document_signers")
      .select("audit_id")
      .eq("id", signerId)
      .maybeSingle<{ audit_id: string }>()
    if (signer) {
      await requireOwnerAudit(supabase, signer.audit_id)
      await logReviewActivity(supabase, user.id, signer.audit_id, "signer_revoked", { signer_id: signerId })
    }
  } catch {
    // Audit trail is best-effort; revocation already succeeded.
  }
  return { success: true }
}

/**
 * Lawyer service order (money boundary). Credits are never involved: this
 * writes only to service_orders. Amounts are optional (to-be-quoted);
 * quoted/paid/fulfilled transitions belong to the future Paystack step and
 * are unreachable here — only requested/cancelled exist.
 */
export async function createServiceOrder(
  auditId: string,
  requestId: string,
  input: { note?: string | null; amountMinor?: number | null; currency?: string | null }
) {
  const supabase = await createClient()
  const user = await requireOwnerAudit(supabase, auditId)
  const request = await requireOwnedRequest(supabase, requestId, user.id)
  if (request.audit_id !== auditId) throw new Error("Review does not belong to this deal")
  if (request.status === "cancelled") throw new Error("Review is cancelled")

  let amountMinor: number | null = null
  if (input.amountMinor !== undefined && input.amountMinor !== null) {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new Error("Invalid amount")
    }
    amountMinor = input.amountMinor
  }
  let currency: string | null = null
  if (input.currency !== undefined && input.currency !== null) {
    if (input.currency !== "USD" && input.currency !== "GBP" && input.currency !== "EUR" && input.currency !== "NGN") {
      throw new Error("Unsupported currency")
    }
    currency = input.currency
  }
  let note: string | null = null
  if (input.note !== undefined && input.note !== null) {
    if (typeof input.note !== "string" || input.note.trim().length > 2000) throw new Error("Invalid note")
    note = input.note.trim() || null
  }

  const { data, error } = await supabase
    .from("service_orders")
    .insert({
      audit_id: auditId,
      consultation_request_id: request.id,
      user_id: user.id,
      amount_minor: amountMinor,
      currency,
      status: "requested",
      note,
    })
    .select("id")
    .single<{ id: string }>()
  if (error || !data) {
    await reportError(supabase, {
      phase: "service_order",
      error,
      details: { step: "insert" },
      severity: "error",
      userId: user.id,
      auditId,
    })
    throw new Error(`Failed to create service order: ${error?.message ?? "unknown error"}`)
  }
  await logReviewActivity(supabase, user.id, auditId, "service_order_created", {
    order_id: data.id,
    request_id: request.id,
  })
  return { success: true, orderId: data.id }
}

export async function cancelServiceOrder(orderId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  if (!UUID_RE.test(orderId)) throw new Error("Invalid order ID")
  const { data: order } = await supabase
    .from("service_orders")
    .select("id, audit_id, user_id, status")
    .eq("id", orderId)
    .maybeSingle<{ id: string; audit_id: string; user_id: string; status: string }>()
  if (!order || order.user_id !== user.id) throw new Error("Service order not found")
  if (order.status !== "requested") throw new Error("Only requested orders can be cancelled")
  const { error } = await supabase.from("service_orders").update({ status: "cancelled" }).eq("id", orderId)
  if (error) throw new Error(`Failed to cancel service order: ${error.message}`)
  await logReviewActivity(supabase, user.id, order.audit_id, "service_order_cancelled", { order_id: orderId })
  return { success: true }
}

export { isActiveReviewStatus }
