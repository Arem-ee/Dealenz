"use server"

import { createClient } from "@/lib/supabase/server"
import { isAdminSessionUser } from "@/lib/auth/admin"
import { reportError } from "@/lib/logger"
import {
  transitionTarget,
  isActiveReviewStatus,
  type ReviewTransition,
} from "@/lib/review/transitions"
import { deriveAttention } from "@/lib/review/attention"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requireUUID(id: string, label: string): void {
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${label}`)
}

async function requireVerifiedLawyer(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !UUID_RE.test(user.id)) throw new Error("Unauthorized")
  const { data: lawyer } = await supabase
    .from("lawyers")
    .select("id")
    .eq("user_id", user.id)
    .eq("verification_status", "verified")
    .maybeSingle<{ id: string }>()
  if (!lawyer) throw new Error("Lawyer access requires a verified lawyer profile")
  return { user, lawyerId: (lawyer as { id: string }).id }
}

interface ReviewRequest {
  id: string
  audit_id: string
  user_id: string
  lawyer_id: string | null
  status: string
}

async function requireAssignedRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  lawyerRowId: string
): Promise<ReviewRequest> {
  requireUUID(requestId, "review request ID")
  const { data, error } = await supabase
    .from("consultation_requests")
    .select("id, audit_id, user_id, lawyer_id, status")
    .eq("id", requestId)
    .single()
  if (error || !data) throw new Error("Review request not found")
  const request = data as ReviewRequest
  if (request.lawyer_id !== lawyerRowId) throw new Error("Not assigned to this review")
  if (!isActiveReviewStatus(request.status)) {
    throw new Error(`Review is ${request.status}; write access is revoked`)
  }
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

async function applyTransition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  request: ReviewRequest,
  transition: ReviewTransition,
  actor: "lawyer" | "owner" | "admin",
  actorUserId: string,
  clearLawyer = false,
  /** Lawyer row id, recorded on decline so automatic re-matching never silently re-assigns the decliner. */
  lawyerRowId: string | null = null
): Promise<string> {
  const t = transitionTarget(transition, request.status, actor)
  if (!t.ok) throw new Error(t.reason)
  const patch: Record<string, unknown> = {
    status: t.to,
    updated_at: new Date().toISOString(),
  }
  if (clearLawyer) patch.lawyer_id = null
  const { error } = await supabase.from("consultation_requests").update(patch).eq("id", request.id)
  if (error) throw new Error(`Failed to update review: ${error.message}`)
  const payload: Record<string, unknown> = {
    request_id: request.id,
    from: request.status,
    to: t.to,
  }
  if (transition === "decline" && lawyerRowId) payload.lawyer_id = lawyerRowId
  await logReviewActivity(supabase, actorUserId, request.audit_id, `review_${transition}`, payload)
  return t.to
}

export interface ReviewListFilter {
  /** Status filter; unknown values are ignored (never widen access). */
  status?: string | null
  /** Only reviews where the lawyer must act (derived server-side). */
  needsAction?: boolean
  limit?: number
  offset?: number
}

export interface ListedReview {
  id: string
  audit_id: string
  status: string
  created_at: string
  updated_at: string
  needsAction: boolean
  waitingOn: string
}

/**
 * Lawyer-scoped review list. The database returns only rows assigned to the
 * caller's verified lawyer profile (lawyer_id fence + bounded page);
 * needs-action flags derive server-side from status. Pagination is
 * offset/limit over updated_at DESC; page size capped at 50.
 */
export async function listAssignedReviews(filter: ReviewListFilter = {}) {
  const supabase = await createClient()
  const { lawyerId } = await requireVerifiedLawyer(supabase)
  const limit = Math.min(Math.max(filter.limit ?? 20, 1), 50)
  const offset = Math.max(filter.offset ?? 0, 0)

  let query = supabase
    .from("consultation_requests")
    .select("id, audit_id, status, created_at, updated_at")
    .eq("lawyer_id", lawyerId)
  const knownStatuses = [
    "requested",
    "waitlist",
    "matched",
    "accepted",
    "in_progress",
    "changes_requested",
    "client_review",
    "completed",
    "cancelled",
  ]
  if (filter.status && knownStatuses.includes(filter.status)) {
    query = query.eq("status", filter.status)
  }
  // Over-fetch one page-worth extra only when filtering needs-action in
  // memory; the base query stays bounded (cap 100 scanned rows).
  const scanLimit = filter.needsAction ? Math.min(limit + offset + 50, 100) : limit + offset + 1
  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .range(offset, offset + scanLimit - 1)
  if (error) throw new Error(`Failed to list reviews: ${error.message}`)
  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((r) => typeof r.id === "string")
  let reviews: ListedReview[] = rows.map((r) => {
    const attention = deriveAttention({ status: String(r.status ?? "") })
    return {
      id: String(r.id),
      audit_id: String(r.audit_id ?? ""),
      status: String(r.status ?? ""),
      created_at: String(r.created_at ?? ""),
      updated_at: String(r.updated_at ?? ""),
      needsAction: attention.needsAction,
      waitingOn: attention.waitingOn,
    }
  })
  if (filter.needsAction) reviews = reviews.filter((r) => r.needsAction)
  const page = reviews.slice(0, limit)
  return { success: true, reviews: page, hasMore: reviews.length > limit }
}

/**
 * Workspace overview: workload buckets + recent activity, all computed from
 * lawyer-scoped server queries. No global counts, no other lawyer's data.
 */
export async function getLawyerOverview() {
  const supabase = await createClient()
  const { lawyerId } = await requireVerifiedLawyer(supabase)
  const { data, error } = await supabase
    .from("consultation_requests")
    .select("id, status, updated_at")
    .eq("lawyer_id", lawyerId)
    .order("updated_at", { ascending: false })
    .limit(200)
  if (error) throw new Error(`Failed to load overview: ${error.message}`)
  const rows = ((data ?? []) as Array<{ id: string; status: string; updated_at: string }>).filter(
    (r) => typeof r.id === "string"
  )
  const buckets = { needsAction: 0, inReview: 0, waitingClient: 0, completed: 0 }
  const actionItems: Array<{ id: string; status: string; waitingOn: string; reasons: string[] }> = []
  for (const r of rows) {
    // Comment-level refinement needs per-review reads; the overview stays
    // status-derived (cheap) while detail pages compute full attention.
    const attention = deriveAttention({ status: r.status })
    if (r.status === "completed" || r.status === "cancelled") {
      buckets.completed++
    } else if (attention.waitingOn === "client") {
      buckets.waitingClient++
    } else if (attention.needsAction) {
      buckets.needsAction++
      if (actionItems.length < 10) {
        actionItems.push({ id: r.id, status: r.status, waitingOn: attention.waitingOn, reasons: attention.reasons })
      }
    } else {
      buckets.inReview++
    }
  }
  const { data: activity } = await supabase.rpc("get_lawyer_activity", { p_request_id: null, p_limit: 20 })
  return {
    success: true,
    buckets,
    actionItems,
    recentActivity: (Array.isArray(activity) ? activity : []) as Array<Record<string, unknown>>,
    totalAssigned: rows.length,
  }
}

/** Scoped activity feed for one assigned review (or null-request for recent). */
export async function getReviewActivity(requestId: string | null, limit = 20) {
  const supabase = await createClient()
  const { lawyerId } = await requireVerifiedLawyer(supabase)
  void lawyerId
  if (requestId !== null && !UUID_RE.test(requestId)) throw new Error("Invalid review request ID")
  const safeLimit = Math.min(Math.max(limit, 1), 100)
  // Assignment + active-status enforcement lives inside the RPC; the RLS on
  // activity_events itself stays owner-only and is never widened.
  const { data, error } = await supabase.rpc("get_lawyer_activity", {
    p_request_id: requestId,
    p_limit: safeLimit,
  })
  if (error) throw new Error(`Failed to load activity: ${error.message}`)
  return { success: true, events: (Array.isArray(data) ? data : []) as Array<Record<string, unknown>> }
}

/** Service orders for one assigned review. Read-only; amounts shown as quoted-or-pending, never as earnings (no payment data exists). */
export async function getReviewServiceOrders(requestId: string) {
  const supabase = await createClient()
  const { lawyerId } = await requireVerifiedLawyer(supabase)
  const request = await requireAssignedRequest(supabase, requestId, lawyerId)
  const { data, error } = await supabase
    .from("service_orders")
    .select("id, amount_minor, currency, status, created_at")
    .eq("consultation_request_id", request.id)
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) throw new Error(`Failed to load service orders: ${error.message}`)
  return { success: true, orders: (data ?? []) as Array<Record<string, unknown>> }
}

/** Own lawyer profile for the workspace settings area. Read-only: verification fields are admin-controlled. */
export async function getOwnLawyerProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const { data, error } = await supabase
    .from("lawyers")
    .select("id, full_name, bio, bar_license_number, bar_jurisdiction, specialties, years_experience, verification_status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Failed to load profile: ${error.message}`)
  if (!data) throw new Error("No lawyer profile found")
  const profile = data as Record<string, unknown>
  return {
    success: true,
    profile: {
      ...profile,
      email: user.email ?? null,
    },
  }
}

export async function getAssignedReview(requestId: string) {
  const supabase = await createClient()
  const { lawyerId } = await requireVerifiedLawyer(supabase)
  await requireAssignedRequest(supabase, requestId, lawyerId)
  // Scoped bundle: the ONLY lawyer path to owner deal data (DEFINER,
  // assignment + active status enforced inside). Audits RLS stays owner-only.
  const { data, error } = await supabase.rpc("get_lawyer_review_bundle", { p_request_id: requestId })
  if (error || !data) throw new Error("Failed to load review package")
  return { success: true, bundle: data as Record<string, unknown> }
}

async function lawyerTransition(requestId: string, transition: ReviewTransition) {
  const supabase = await createClient()
  const { user, lawyerId } = await requireVerifiedLawyer(supabase)
  const request = await requireAssignedRequest(supabase, requestId, lawyerId)
  const to = await applyTransition(supabase, request, transition, "lawyer", user.id, transition === "decline", lawyerId)
  return { success: true, status: to }
}

export async function acceptReview(requestId: string) {
  return lawyerTransition(requestId, "accept")
}

export async function declineReview(requestId: string) {
  return lawyerTransition(requestId, "decline")
}

export async function beginReview(requestId: string) {
  return lawyerTransition(requestId, "begin")
}

export async function completeReview(requestId: string) {
  return lawyerTransition(requestId, "complete")
}

const COMMENT_TARGETS = ["finding", "clause", "fact", "evidence", "document", "question", "general"] as const

export async function addLawyerComment(
  requestId: string,
  input: { targetType: string; targetKey?: string | null; documentVersionId?: string | null; body: string }
) {
  const supabase = await createClient()
  const { user, lawyerId } = await requireVerifiedLawyer(supabase)
  const request = await requireAssignedRequest(supabase, requestId, lawyerId)

  if (!(COMMENT_TARGETS as ReadonlyArray<string>).includes(input.targetType)) {
    throw new Error("Invalid comment target")
  }
  const body = typeof input.body === "string" ? input.body.trim() : ""
  if (body.length === 0 || body.length > 5000) throw new Error("Comment must be 1–5000 characters")
  if (input.targetKey !== undefined && input.targetKey !== null) {
    if (typeof input.targetKey !== "string" || input.targetKey.length > 200) throw new Error("Invalid target reference")
  }
  let versionId: string | null = null
  if (input.documentVersionId !== undefined && input.documentVersionId !== null) {
    if (!UUID_RE.test(input.documentVersionId)) throw new Error("Invalid document version")
    // Version must belong to this deal. Lawyers cannot read
    // document_versions via RLS (owner-only by design), so membership is
    // verified through the same scoped bundle RPC, never a direct read.
    const { data: bundle } = await supabase.rpc("get_lawyer_review_bundle", { p_request_id: requestId })
    const versions = ((bundle as Record<string, unknown> | null)?.versions as Array<{ id: string }> | undefined) ?? []
    if (!versions.some((v) => v.id === input.documentVersionId)) {
      throw new Error("Document version does not belong to this deal")
    }
    versionId = input.documentVersionId
  }

  const { error } = await supabase.from("review_comments").insert({
    consultation_request_id: request.id,
    audit_id: request.audit_id,
    author_user_id: user.id,
    author_role: "lawyer",
    target_type: input.targetType,
    target_key: input.targetKey ?? null,
    document_version_id: versionId,
    body,
    status: "open",
    provenance: "lawyer",
  })
  if (error) {
    await reportError(supabase, {
      phase: "review_comment",
      error,
      details: { step: "lawyer_insert", requestId },
      severity: "error",
      userId: user.id,
      auditId: request.audit_id,
    })
    throw new Error(`Failed to add comment: ${error.message}`)
  }
  await logReviewActivity(supabase, user.id, request.audit_id, "review_comment_added", {
    request_id: request.id,
    target_type: input.targetType,
  })
  return { success: true }
}

export async function proposeChange(
  requestId: string,
  input: { documentType: string; revisedContent: string; note: string }
) {
  const supabase = await createClient()
  const { user, lawyerId } = await requireVerifiedLawyer(supabase)
  const request = await requireAssignedRequest(supabase, requestId, lawyerId)

  const documentType = typeof input.documentType === "string" ? input.documentType.trim() : ""
  if (!documentType || documentType.length > 120) throw new Error("Invalid document type")
  const revisedContent = typeof input.revisedContent === "string" ? input.revisedContent : ""
  if (revisedContent.trim().length === 0 || revisedContent.length > 200000) {
    throw new Error("Revised content must be 1–200000 characters")
  }
  const note = typeof input.note === "string" ? input.note.trim() : ""
  if (note.length === 0 || note.length > 2000) throw new Error("Proposal note must be 1–2000 characters")

  // Validate the transition before any write: no partial proposals.
  const allowed = transitionTarget("propose", request.status, "lawyer")
  if (!allowed.ok) throw new Error(allowed.reason)

  // Comment first (versionless notes are still valid comments), then the new
  // version, then link them — so every failure mode leaves visible,
  // correctly-provenanced state rather than silent orphans.
  const { data: comment, error: commentError } = await supabase
    .from("review_comments")
    .insert({
      consultation_request_id: request.id,
      audit_id: request.audit_id,
      author_user_id: user.id,
      author_role: "lawyer",
      target_type: "document",
      target_key: documentType,
      document_version_id: null,
      body: note,
      status: "open",
      provenance: "lawyer",
    })
    .select("id")
    .single<{ id: string }>()
  if (commentError || !comment) {
    throw new Error(`Failed to record proposal: ${commentError?.message ?? "unknown error"}`)
  }

  const { data: versionRows, error: versionError } = await supabase.rpc("lawyer_create_version", {
    p_request_id: request.id,
    p_document_type: documentType,
    p_content: revisedContent,
  })
  if (versionError || !versionRows) {
    throw new Error(`Proposal note saved, but revision failed: ${versionError?.message ?? "unknown error"}`)
  }
  const versionRow = (Array.isArray(versionRows) ? versionRows[0] : versionRows) as
    | { version_id: string; version_number: number }
    | undefined
  if (!versionRow) throw new Error("Proposal note saved, but revision failed: empty result")

  await supabase
    .from("review_comments")
    .update({ document_version_id: versionRow.version_id })
    .eq("id", (comment as { id: string }).id)

  const to = await applyTransition(supabase, request, "propose", "lawyer", user.id)
  return { success: true, status: to, versionId: versionRow.version_id, versionNumber: versionRow.version_number }
}

/** Manual admin assignment (exception path). Normal matching is automatic via
 * auto_assign_review; this remains for governance overrides and cases the
 * conservative matcher declines (e.g. jurisdiction judgment calls). */
export async function assignLawyer(requestId: string, lawyerRowId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  if (!isAdminSessionUser(user)) throw new Error("Administrator access required")
  requireUUID(requestId, "review request ID")
  requireUUID(lawyerRowId, "lawyer ID")

  const { data: request } = await supabase
    .from("consultation_requests")
    .select("id, audit_id, status, lawyer_id")
    .eq("id", requestId)
    .maybeSingle<ReviewRequest | null>()
  if (!request) throw new Error("Review request not found")
  const t = transitionTarget("assign", request.status, "admin")
  if (!t.ok) throw new Error(t.reason)

  const { data: lawyer } = await supabase
    .from("lawyers")
    .select("id")
    .eq("id", lawyerRowId)
    .eq("verification_status", "verified")
    .maybeSingle<{ id: string }>()
  if (!lawyer) throw new Error("Lawyer must be verified before assignment")

  const { error } = await supabase
    .from("consultation_requests")
    .update({ lawyer_id: lawyerRowId, status: t.to, updated_at: new Date().toISOString() })
    .eq("id", requestId)
  if (error) throw new Error(`Failed to assign lawyer: ${error.message}`)
  await logReviewActivity(supabase, user.id, request.audit_id, "review_assigned", {
    request_id: requestId,
    lawyer_id: lawyerRowId,
  })
  return { success: true, status: t.to }
}
