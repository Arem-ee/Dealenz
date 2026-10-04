"use server"

import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { toActionFailure } from "@/lib/action-result"

// Team approval queue (phase 1: named approvers). The requester files a
// plan to an Owner/Admin of a shared org; the approver's verdict + comment
// freeze on the row, and a live approved verdict authorizes execution
// through the same version/hash seal the self-flow uses. Solo users are
// untouched: with no team request pending, self-approval works exactly
// as before.

const VERIFY_REQUIRED_ERROR = "Please verify your email address before using this feature."
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ApprovalRequestRow {
  id: string
  user_id: string
  approver_user_id: string
  subject_type: string
  subject_id: string
  title: string
  detail: string
  verdict: "pending" | "approved" | "rejected"
  comment: string | null
  plan_version: number | null
  decided_at: string | null
  created_at: string
  approver_email?: string | null
  requester_email?: string | null
}

async function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const { createClient: createServiceClient } = await import("@supabase/supabase-js")
  return createServiceClient(url, key)
}

/**
 * Approver eligibility: the approver holds owner/admin in an org the
 * requester belongs to. Service-side read — membership rows of other
 * users are not requester-readable by RLS.
 */
async function approverEligible(svc: NonNullable<Awaited<ReturnType<typeof serviceClient>>>, requesterId: string, approverId: string): Promise<boolean> {
  const { data: mine } = await svc.from("organization_members").select("org_id").eq("user_id", requesterId)
  const orgIds = (((mine ?? []) as Array<{ org_id: string }>).map((m) => m.org_id))
  if (orgIds.length === 0) return false
  const { data: theirs } = await svc
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", approverId)
    .in("org_id", orgIds)
    .in("role", ["owner", "admin"])
  return (((theirs ?? []) as unknown[]).length > 0)
}

async function emailsFor(svc: NonNullable<Awaited<ReturnType<typeof serviceClient>>>, userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
    for (const u of ((data as { users?: Array<{ id: string; email?: string }> } | null)?.users ?? [])) {
      if (userIds.includes(u.id)) map.set(u.id, u.email ?? "")
    }
  } catch {
    // Emails are display-only; the queue works without them.
  }
  return map
}

export async function listApprovalQueue() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const { data, error } = await supabase
      .from("approval_requests")
      .select("id, user_id, approver_user_id, subject_type, subject_id, title, detail, verdict, comment, plan_version, decided_at, created_at")
      .or(`user_id.eq.${user.id},approver_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(100)
    if (error) {
      if (error.message.includes("approval_requests")) {
        return { ok: false as const, error: "Approvals need a database update (migration 00096). Please try again after migrating." }
      }
      throw new Error(error.message)
    }
    const rows = ((data ?? []) as ApprovalRequestRow[]).filter((r) => ["pending", "approved", "rejected"].includes(r.verdict))
    const ids = [...new Set(rows.flatMap((r) => [r.user_id, r.approver_user_id]))]
    const svc = await serviceClient()
    const emails = svc ? await emailsFor(svc, ids) : new Map<string, string>()
    const withEmails = rows.map((r) => ({
      ...r,
      requester_email: emails.get(r.user_id) ?? null,
      approver_email: emails.get(r.approver_user_id) ?? null,
    }))
    return {
      ok: true as const,
      incoming: withEmails.filter((r) => r.approver_user_id === user.id),
      outgoing: withEmails.filter((r) => r.user_id === user.id),
    }
  } catch (e) {
    return toActionFailure(e, "Could not load approvals.") as never
  }
}

/** The requester's own draft/awaiting plans — the request picker. */
export async function listRequestablePlans() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const { data, error } = await supabase
      .from("work_plans")
      .select("id, objective, estimated_credits, version, status, conversation_id")
      .eq("user_id", user.id)
      .in("status", ["draft", "awaiting_approval"])
      .order("updated_at", { ascending: false })
      .limit(20)
    if (error) throw new Error(error.message)
    return {
      ok: true as const,
      plans: ((data ?? []) as Array<{ id: string; objective: string; estimated_credits: number; version: number; status: string; conversation_id: string | null }>),
    }
  } catch (e) {
    return toActionFailure(e, "Could not load plans.") as never
  }
}

/** Owners/admins of the requester's orgs, excluding self — the approver picker. */
export async function listApprovers() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const svc = await serviceClient()
    if (!svc) return { ok: false as const, error: "Service not configured." }
    const { data: mine } = await svc.from("organization_members").select("org_id").eq("user_id", user.id)
    const orgIds = (((mine ?? []) as Array<{ org_id: string }>).map((m) => m.org_id))
    if (orgIds.length === 0) return { ok: true as const, approvers: [] as Array<{ userId: string; email: string; orgId: string }> }
    const { data: members } = await svc
      .from("organization_members")
      .select("org_id, user_id, role")
      .in("org_id", orgIds)
      .in("role", ["owner", "admin"])
      .neq("user_id", user.id)
    const rows = ((members ?? []) as Array<{ org_id: string; user_id: string; role: string }>)
    const emails = await emailsFor(svc, rows.map((m) => m.user_id))
    return {
      ok: true as const,
      approvers: rows.map((m) => ({ userId: m.user_id, email: emails.get(m.user_id) ?? "", orgId: m.org_id })),
    }
  } catch (e) {
    return toActionFailure(e, "Could not load approvers.") as never
  }
}

export async function requestApprovalDecision(input: { planId: string; approverUserId: string; title?: string; detail?: string }) {
  try {
    if (!UUID_RE.test(input.planId) || !UUID_RE.test(input.approverUserId)) {
      return { ok: false as const, error: "Invalid plan or approver." }
    }
    if (input.approverUserId.toLowerCase() === "") return { ok: false as const, error: "Pick an approver." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: VERIFY_REQUIRED_ERROR }
    if (input.approverUserId === user.id) return { ok: false as const, error: "You can't route approvals to yourself — approve directly instead." }

    const svc = await serviceClient()
    if (!svc) return { ok: false as const, error: "Service not configured." }
    if (!(await approverEligible(svc, user.id, input.approverUserId))) {
      return { ok: false as const, error: "Approvers must be an owner or admin of an organization you belong to." }
    }

    const { data: plan } = await supabase
      .from("work_plans")
      .select("id, status, objective, estimated_credits, version")
      .eq("id", input.planId)
      .eq("user_id", user.id)
      .maybeSingle()
    const planRow = plan as { id: string; status: string; objective: string; estimated_credits: number; version: number } | null
    if (!planRow) return { ok: false as const, error: "Plan not found." }
    if (planRow.status !== "awaiting_approval" && planRow.status !== "draft") {
      return { ok: false as const, error: `Plans in ${planRow.status} can't enter the queue.` }
    }
    if (planRow.status === "draft") {
      const { requestPlanApproval } = await import("@/lib/work/store")
      try {
        await requestPlanApproval(supabase as never, user.id, planRow.id)
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : "Could not request approval." }
      }
    }

    const { data: live } = await supabase
      .from("approval_requests")
      .select("id")
      .eq("subject_type", "plan")
      .eq("subject_id", planRow.id)
      .eq("verdict", "pending")
      .maybeSingle()
    if (live) return { ok: false as const, error: "That plan already awaits a decision — one live request at a time." }

    const title = (input.title ?? `Approve: ${planRow.objective}`).trim().slice(0, 120) || "Plan approval"
    const detail = (input.detail ?? `Batch plan, estimated ${planRow.estimated_credits} credits, version ${planRow.version}.`).trim().slice(0, 1000)
    const { data: created, error } = await supabase
      .from("approval_requests")
      .insert({
        user_id: user.id,
        approver_user_id: input.approverUserId,
        subject_type: "plan",
        subject_id: planRow.id,
        title,
        detail: detail || "Plan approval.",
      })
      .select("id")
      .single()
    if (error || !created) {
      if (error?.message?.includes("approval_requests")) {
        return { ok: false as const, error: "Approvals need a database update (migration 00096). Please try again after migrating." }
      }
      return { ok: false as const, error: "We couldn't file that request." }
    }

    try {
      const { createNotification } = await import("@/lib/notifications/store")
      await createNotification(supabase, {
        userId: input.approverUserId,
        type: "approval",
        title: "Approval requested",
        body: `${user.email ?? "A teammate"} asked you to decide: ${title}`,
        link: "/approvals",
      })
    } catch {
      // The request stands regardless; the notification is best-effort.
    }
    return { ok: true as const, id: (created as { id: string }).id }
  } catch (e) {
    return toActionFailure(e, "Could not file that request.") as never
  }
}

export async function decideApprovalRequest(input: { requestId: string; verdict: "approved" | "rejected"; comment?: string }) {
  try {
    if (!UUID_RE.test(input.requestId)) return { ok: false as const, error: "Invalid request." }
    const comment = (input.comment ?? "").trim().slice(0, 1000)
    if (input.verdict === "rejected" && !comment) {
      return { ok: false as const, error: "A rejection needs a reason — the requester must know what to fix." }
    }
    if (input.verdict !== "approved" && input.verdict !== "rejected") {
      return { ok: false as const, error: "Invalid verdict." }
    }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: VERIFY_REQUIRED_ERROR }

    const { data: req } = await supabase
      .from("approval_requests")
      .select("id, user_id, approver_user_id, subject_type, subject_id, title, verdict")
      .eq("id", input.requestId)
      .maybeSingle()
    const reqRow = req as { id: string; user_id: string; approver_user_id: string; subject_type: string; subject_id: string; title: string; verdict: string } | null
    if (!reqRow) return { ok: false as const, error: "Request not found." }
    if (reqRow.approver_user_id !== user.id) return { ok: false as const, error: "Only the designated approver can decide." }
    if (reqRow.verdict !== "pending") return { ok: false as const, error: "That request is already decided — decisions are final." }
    if (reqRow.subject_type !== "plan") return { ok: false as const, error: "Unknown approval subject." }

    const svc = await serviceClient()
    if (!svc) return { ok: false as const, error: "Service not configured." }
    if (!(await approverEligible(svc, reqRow.user_id, user.id))) {
      return { ok: false as const, error: "You are no longer an approver for that teammate's organization." }
    }

    // Snapshot the exact version+hash under decision: execution later
    // re-verifies both, so a plan edited after approval cannot ride it.
    const { data: plan } = await svc
      .from("work_plans")
      .select("id, user_id, status, version, payload_hash, deal_id")
      .eq("id", reqRow.subject_id)
      .maybeSingle()
    const planRow = plan as { id: string; user_id: string; status: string; version: number; payload_hash: string; deal_id: string | null } | null
    if (!planRow || planRow.user_id !== reqRow.user_id) {
      return { ok: false as const, error: "That plan is gone — the request is closed.",
        }
    }
    if (planRow.status !== "awaiting_approval") {
      return { ok: false as const, error: `That plan already moved to ${planRow.status} — nothing left to decide.` }
    }

    const now = new Date().toISOString()
    const { error: decideError } = await supabase
      .from("approval_requests")
      .update({
        verdict: input.verdict,
        comment: comment || null,
        plan_version: planRow.version,
        approved_payload_hash: input.verdict === "approved" ? planRow.payload_hash : null,
        decided_at: now,
      })
      .eq("id", reqRow.id)
      .eq("verdict", "pending")
    if (decideError) return { ok: false as const, error: "We couldn't record that decision." }

    // Move the plan exactly like the self-flow's approve/reject, as the
    // teammate's authorized hand: approve → approved, reject → draft.
    const nextStatus = input.verdict === "approved" ? "approved" : "draft"
    const { error: planError } = await svc
      .from("work_plans")
      .update({
        status: nextStatus,
        approved_at: input.verdict === "approved" ? now : null,
        updated_at: now,
      })
      .eq("id", planRow.id)
      .eq("status", "awaiting_approval")
    if (planError) return { ok: false as const, error: "Decision recorded, but the plan had already moved — nothing further to do." }

    try {
      await svc.from("activity_events").insert({
        user_id: planRow.user_id,
        audit_id: planRow.deal_id,
        event_type: input.verdict === "approved" ? "plan_approved" : "plan_rejected",
        payload: { plan_id: planRow.id, request_id: reqRow.id, decided_by: user.id, comment: comment || null },
      })
    } catch {
      // Audit is best-effort; the frozen row is the record.
    }
    try {
      const { createNotification } = await import("@/lib/notifications/store")
      await createNotification(svc, {
        userId: planRow.user_id,
        type: "approval",
        title: input.verdict === "approved" ? "Plan approved" : "Plan rejected",
        body: input.verdict === "approved"
          ? `${user.email ?? "Your approver"} approved “${reqRow.title}” — it can execute now.`
          : `${user.email ?? "Your approver"} rejected “${reqRow.title}”: ${comment}`,
        link: "/approvals",
      })
    } catch {
      // The decision stands regardless; the notification is best-effort.
    }
    return { ok: true as const, verdict: input.verdict }
  } catch (e) {
    return toActionFailure(e, "Could not record that decision.") as never
  }
}

/**
 * Live team authorization for a plan: the latest approved verdict whose
 * frozen version+hash still match the plan. The executor treats it like
 * the self-flow's approval row — same seal, different authorizer.
 */
export async function findLiveTeamApproval(
  client: SupabaseClient,
  planId: string
): Promise<{ id: string; plan_version: number; approved_payload_hash: string } | null> {
  // Owner scope rides on RLS (requester or approver rows only) — the
  // caller passes their own authenticated client.
  const { data } = await client
    .from("approval_requests")
    .select("id, plan_version, approved_payload_hash")
    .eq("subject_type", "plan")
    .eq("subject_id", planId)
    .eq("verdict", "approved")
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const row = data as { id: string; plan_version: number | null; approved_payload_hash: string | null } | null
  if (!row || row.plan_version === null || !row.approved_payload_hash) return null
  return { id: `team:${row.id}`, plan_version: row.plan_version, approved_payload_hash: row.approved_payload_hash }
}
