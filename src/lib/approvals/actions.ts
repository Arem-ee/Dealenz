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
  approver_user_id: string | null
  approver_group_id: string | null
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
  group_name?: string | null
  covered_for?: string | null
  steps?: ApprovalStepView[]
}

export interface ApprovalStepView {
  no: number
  verdict: "pending" | "approved" | "rejected" | "skipped"
  route: string
  decided_by: string | null
}

export interface ApprovalLeg {
  userId?: string
  groupId?: string
}

const MAX_LEGS = 5

function legError(legs: ApprovalLeg[] | undefined): string | null {
  if (!legs || legs.length === 0) return "Add at least one approval step."
  if (legs.length > MAX_LEGS) return `At most ${MAX_LEGS} steps — split longer chains across requests.`
  for (const [i, leg] of legs.entries()) {
    const named = !!leg.userId
    const grouped = !!leg.groupId
    if ((named && grouped) || (!named && !grouped)) return `Step ${i + 1} routes to one person or one group — not both, not neither.`
    if (named && !UUID_RE.test(leg.userId as string)) return `Step ${i + 1} names an invalid approver.`
    if (grouped && !UUID_RE.test(leg.groupId as string)) return `Step ${i + 1} names an invalid group.`
  }
  return null
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
      .select("id, user_id, approver_user_id, approver_group_id, subject_type, subject_id, title, detail, verdict, comment, plan_version, decided_at, created_at")
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
    // Group-routed rows visible to the caller ride RLS (member-only), but
    // the .or() above only matches named legs — union them explicitly.
    try {
      const { data: groupRows } = await supabase
        .from("approval_requests")
        .select("id, user_id, approver_user_id, approver_group_id, subject_type, subject_id, title, detail, verdict, comment, plan_version, decided_at, created_at")
        .not("approver_group_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100)
      for (const g of ((groupRows ?? []) as ApprovalRequestRow[])) {
        if (!rows.some((r) => r.id === g.id) && ["pending", "approved", "rejected"].includes(g.verdict)) {
          rows.push(g)
        }
      }
      rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    } catch {
      // Named legs already loaded; group legs are additive.
    }
    const ids = [...new Set(rows.flatMap((r) => [r.user_id, r.approver_user_id]).filter((v): v is string => v !== null))]
    const svc = await serviceClient()
    const emails = svc ? await emailsFor(svc, ids) : new Map<string, string>()
    const groupIds = [...new Set(rows.map((r) => r.approver_group_id).filter((v): v is string => v !== null))]
    const groupNames = new Map<string, string>()
    if (groupIds.length > 0) {
      const { data: groups } = await supabase
        .from("permission_groups")
        .select("id, name")
        .in("id", groupIds)
      for (const g of ((groups ?? []) as Array<{ id: string; name: string }>)) groupNames.set(g.id, g.name)
    }
    const withEmails = rows.map((r) => ({
      ...r,
      requester_email: emails.get(r.user_id) ?? null,
      approver_email: r.approver_user_id ? (emails.get(r.approver_user_id) ?? null) : null,
      group_name: r.approver_group_id ? (groupNames.get(r.approver_group_id) ?? null) : null,
    }))
    const attachCover = (r: ApprovalRequestRow): ApprovalRequestRow => {
      const delegator = coveredBy.get(r.id)
      return { ...r, covered_for: delegator ? (emails.get(delegator) ?? null) : null }
    }
    // Step ledger for display: route labels resolved from the maps above.
    try {
      const ids = withEmails.map((r) => r.id)
      if (ids.length > 0) {
        const { data: stepRows } = await supabase
          .from("approval_steps")
          .select("request_id, step_no, approver_user_id, approver_group_id, verdict")
          .in("request_id", ids)
          .order("step_no", { ascending: true })
          .limit(500)
        const byRequest = new Map<string, ApprovalStepView[]>()
        for (const s of ((stepRows ?? []) as Array<{
          request_id: string; step_no: number; approver_user_id: string | null;
          approver_group_id: string | null; verdict: string;
        }>)) {
          if (!byRequest.has(s.request_id)) byRequest.set(s.request_id, [])
          const route = s.approver_group_id
            ? (groupNames.get(s.approver_group_id) ?? "Group")
            : (s.approver_user_id ? (emails.get(s.approver_user_id) ?? "Approver") : "—")
          byRequest.get(s.request_id)!.push({
            no: s.step_no,
            verdict: (s.verdict === "approved" || s.verdict === "rejected" || s.verdict === "skipped" ? s.verdict : "pending"),
            route,
            decided_by: null,
          })
        }
        for (const r of withEmails) {
          const legs = byRequest.get(r.id)
          if (legs && legs.length > 0) r.steps = legs
        }
      }
    } catch {
      // Steps are display-only; the queue works without them.
    }
    // Delegated legs: rows I cover through a live grant (incoming) or
    // covered through any grant ever held (decided history). Grants are
    // mine to read; coverage matching mirrors delegation_covers_request.
    const coveredPending = new Set<string>()
    const coveredDecided = new Set<string>()
    const coveredBy = new Map<string, string>()
    if (svc) {
      try {
        const { data: grants } = await svc
          .from("approval_delegations")
          .select("id, group_id, delegator, is_active")
          .eq("delegate", user.id)
          .limit(50)
        const allGrants = ((grants ?? []) as Array<{ id: string; group_id: string | null; delegator: string; is_active: boolean }>)
        const live = allGrants.filter((g) => g.is_active)
        const { data: extra } = await supabase
          .from("approval_requests")
          .select("id, user_id, approver_user_id, approver_group_id, subject_type, subject_id, title, detail, verdict, comment, plan_version, decided_at, created_at")
          .neq("verdict", "pending")
          .order("created_at", { ascending: false })
          .limit(100)
        const candidates = [...withEmails, ...(((extra ?? []) as ApprovalRequestRow[]).filter((e) => !withEmails.some((r) => r.id === e.id) && ["approved", "rejected"].includes(e.verdict)))]
        for (const c of candidates) {
          if (c.user_id === user.id) continue
          const match = allGrants.find((g) =>
            g.delegator === c.approver_user_id ||
            (c.approver_group_id !== null && (g.group_id === null || g.group_id === c.approver_group_id))
          )
          // Group match also needs the granter in the group at read time;
          // designated matches are exact. (Decide-time re-validates fully.)
          if (match && (match.delegator === c.approver_user_id || c.approver_group_id === null || match.group_id === null)) {
            if (c.verdict === "pending" && live.some((g) => g.id === match.id)) { coveredPending.add(c.id); coveredBy.set(c.id, match.delegator) }
            else if (c.verdict !== "pending") { coveredDecided.add(c.id); coveredBy.set(c.id, match.delegator) }
          } else if (match && c.approver_group_id !== null) {
            const granterIn = await groupDeciderEligible(svc, c.approver_group_id, match.delegator).catch(() => false)
            if (granterIn) {
              if (c.verdict === "pending" && live.some((g) => g.id === match.id)) { coveredPending.add(c.id); coveredBy.set(c.id, match.delegator) }
              else if (c.verdict !== "pending") { coveredDecided.add(c.id); coveredBy.set(c.id, match.delegator) }
            }
          }
        }
        for (const e of ((extra ?? []) as ApprovalRequestRow[])) {
          if (coveredDecided.has(e.id) && !withEmails.some((r) => r.id === e.id)) {
            withEmails.push({
              ...e,
              requester_email: emails.get(e.user_id) ?? null,
              approver_email: e.approver_user_id ? (emails.get(e.approver_user_id) ?? null) : null,
              group_name: e.approver_group_id ? (groupNames.get(e.approver_group_id) ?? null) : null,
            })
          }
        }
      } catch {
        // Named + group legs already loaded; delegation legs are additive.
      }
    }
    return {
      ok: true as const,
      incoming: withEmails.filter((r) =>
        r.approver_user_id === user.id ||
        (r.approver_group_id !== null && r.user_id !== user.id) ||
        coveredPending.has(r.id) ||
        coveredDecided.has(r.id)
      ).map(attachCover),
      outgoing: withEmails.filter((r) => r.user_id === user.id).map(attachCover),
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

/** Groups of the requester's orgs — the group routing picker. */
export async function listApprovalGroups() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const svc = await serviceClient()
    if (!svc) return { ok: false as const, error: "Service not configured." }
    const { data: mine } = await svc.from("organization_members").select("org_id").eq("user_id", user.id)
    const orgIds = (((mine ?? []) as Array<{ org_id: string }>).map((m) => m.org_id))
    if (orgIds.length === 0) return { ok: true as const, groups: [] as Array<{ groupId: string; name: string; orgId: string; members: number }> }
    const { data: groups } = await svc
      .from("permission_groups")
      .select("id, org_id, name")
      .in("org_id", orgIds)
      .order("name", { ascending: true })
      .limit(50)
    const groupRows = ((groups ?? []) as Array<{ id: string; org_id: string; name: string }>)
    const { data: members } = await svc
      .from("permission_group_members")
      .select("group_id")
      .in("group_id", groupRows.map((g) => g.id))
      .limit(500)
    const counts = new Map<string, number>()
    for (const m of ((members ?? []) as Array<{ group_id: string }>)) {
      counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1)
    }
    return {
      ok: true as const,
      groups: groupRows.map((g) => ({ groupId: g.id, name: g.name, orgId: g.org_id, members: counts.get(g.id) ?? 0 })),
    }
  } catch (e) {
    return toActionFailure(e, "Could not load groups.") as never
  }
}

/** Live delegations where the caller is the cover, with scope. */
async function liveDelegationsFor(
  svc: NonNullable<Awaited<ReturnType<typeof serviceClient>>>,
  delegateId: string
): Promise<Array<{ id: string; org_id: string; group_id: string | null; delegator: string }>> {
  const now = new Date().toISOString()
  const { data } = await svc
    .from("approval_delegations")
    .select("id, org_id, group_id, delegator")
    .eq("delegate", delegateId)
    .eq("is_active", true)
    .is("revoked_at", null)
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .limit(50)
  return ((data ?? []) as Array<{ id: string; org_id: string; group_id: string | null; delegator: string }>)
}

/**
 * Delegation coverage for one request: a live grant whose delegator is
 * the routed party (designated user or member of the routed group) and
 * whose scope matches. Mirrors delegation_covers_request in SQL.
 */
async function delegationCovers(
  svc: NonNullable<Awaited<ReturnType<typeof serviceClient>>>,
  userId: string,
  req: { approver_user_id: string | null; approver_group_id: string | null }
): Promise<{ id: string; delegator: string } | null> {
  const grants = await liveDelegationsFor(svc, userId)
  for (const g of grants) {
    if (g.group_id !== null && g.group_id !== req.approver_group_id) continue
    if (g.delegator === req.approver_user_id) return { id: g.id, delegator: g.delegator }
    if (req.approver_group_id !== null && await groupDeciderEligible(svc, req.approver_group_id, g.delegator)) {
      return { id: g.id, delegator: g.delegator }
    }
  }
  return null
}
/** True when the user may decide for the group (membership, any role). */
async function groupDeciderEligible(
  svc: NonNullable<Awaited<ReturnType<typeof serviceClient>>>,
  groupId: string,
  userId: string
): Promise<boolean> {
  const { data } = await svc
    .from("permission_group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle()
  return data !== null
}

/** Fan group notifications out to members, skipping the requester. Best-effort. */
async function notifyGroup(
  svc: NonNullable<Awaited<ReturnType<typeof serviceClient>>>,
  groupId: string,
  skipUserId: string,
  input: { title: string; body: string }
): Promise<void> {
  try {
    const { data: members } = await svc
      .from("permission_group_members")
      .select("user_id")
      .eq("group_id", groupId)
      .limit(50)
    const ids = (((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id)).filter((id) => id !== skipUserId)
    if (ids.length === 0) return
    const { createNotification } = await import("@/lib/notifications/store")
    for (const id of ids) {
      try {
        await createNotification(svc, { userId: id, type: "approval", title: input.title.slice(0, 120), body: input.body.slice(0, 500), link: "/approvals", category: "approval_requests" })
      } catch {
        // One missed member never blocks the rest.
      }
    }
  } catch {
    // Group notify never breaks the request.
  }
}
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

export async function requestApprovalDecision(input: { planId: string; approverUserId?: string; approverGroupId?: string; legs?: ApprovalLeg[]; title?: string; detail?: string }) {
  try {
    // Legs (ordered steps) subsume the single-route inputs: one leg keeps
    // the old call shape working, several build a chain. The parent row
    // always mirrors the first leg.
    const legs: ApprovalLeg[] = input.legs && input.legs.length > 0
      ? input.legs
      : input.approverUserId
        ? [{ userId: input.approverUserId }]
        : input.approverGroupId
          ? [{ groupId: input.approverGroupId }]
          : []
    const legsProblem = legError(legs)
    if (legsProblem) return { ok: false as const, error: legsProblem }
    const first = legs[0] as ApprovalLeg
    const named = !!first.userId
    if (!UUID_RE.test(input.planId)) return { ok: false as const, error: "Invalid plan." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: VERIFY_REQUIRED_ERROR }

    const svc = await serviceClient()
    if (!svc) return { ok: false as const, error: "Service not configured." }
    // Every leg validates like a standalone route: named legs need an
    // owner/admin approver, group legs need a same-org group, nobody
    // routes any leg to themselves (the DB CHECK pins the first; the
    // app pins the rest).
    for (const [i, leg] of legs.entries()) {
      if (leg.userId) {
        if (leg.userId === user.id) {
          return { ok: false as const, error: `Step ${i + 1} routes to you — approve directly instead.` }
        }
        if (!(await approverEligible(svc, user.id, leg.userId))) {
          return { ok: false as const, error: `Step ${i + 1}: approvers must be an owner or admin of an organization you belong to.` }
        }
      } else if (leg.groupId) {
        const { data: group } = await svc
          .from("permission_groups")
          .select("id, org_id, name")
          .eq("id", leg.groupId)
          .maybeSingle()
        const g = group as { id: string; org_id: string; name: string } | null
        if (!g) return { ok: false as const, error: `Step ${i + 1}: group not found.` }
        const { data: membership } = await svc
          .from("organization_members")
          .select("org_id")
          .eq("org_id", g.org_id)
          .eq("user_id", user.id)
          .maybeSingle()
        if (!membership) return { ok: false as const, error: `Step ${i + 1}: you can only route to groups of your own organizations.` }
      }
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
        approver_user_id: named ? (first.userId as string) : null,
        approver_group_id: !named ? (first.groupId as string) : null,
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
      return { ok: false, error: "We couldn't file that request." }
    }
    const requestId = (created as { id: string }).id
    // Step rows mirror the legs; later legs wait their turn. Insert
    // failures roll the request back — a request without its chain is a
    // lie about who must decide.
    const stepRows = legs.map((leg, i) => ({
      request_id: requestId,
      step_no: i,
      approver_user_id: leg.userId ?? null,
      approver_group_id: leg.groupId ?? null,
    }))
    const { error: stepError } = await supabase.from("approval_steps").insert(stepRows)
    if (stepError) {
      try {
        await svc.from("approval_requests").delete().eq("id", requestId).eq("verdict", "pending")
      } catch {
        // Rollback is best-effort; the unique live-subject guard bounds damage.
      }
      if (stepError.message?.includes("approval_steps")) {
        return { ok: false as const, error: "Approvals need a database update (migration 00101). Please try again after migrating." }
      }
      return { ok: false, error: "We couldn't file that request." }
    }

    try {
      if (!named) {
        await notifyGroup(svc, first.groupId as string, user.id, {
          title: "Approval requested",
          body: `${user.email ?? "A teammate"} asked your group to decide: ${title}${legs.length > 1 ? ` (step 1 of ${legs.length})` : ""}`,
        })
      } else {
        const { createNotification } = await import("@/lib/notifications/store")
        await createNotification(supabase, {
          userId: first.userId as string,
          type: "approval",
          category: "approval_requests",
          title: "Approval requested",
          body: `${user.email ?? "A teammate"} asked you to decide: ${title}${legs.length > 1 ? ` (step 1 of ${legs.length})` : ""}`,
          link: "/approvals",
        })
      }
    } catch {
      // The request stands regardless; the notification is best-effort.
    }
    return { ok: true as const, id: requestId }
  } catch (e) {
    return toActionFailure(e, "Could not file that request.") as never
  }
}

/**
 * Clause escalation (pairing D3): a linked position's exhausted ladder (or
 * its escalate flag) files a verdict-only decision request. Same routing
 * machinery as plan approvals (legs, groups, delegation, eligibility) but
 * subject_type='escalation' with NO approval_steps rows — the parent
 * routing is the only leg (the legacy single-leg shape), and deciding
 * records a verdict with zero execution side effects. Execution gating
 * stays plan-exclusive: findLiveTeamApproval keeps filtering plans.
 */
export async function requestEscalationDecision(input: {
  auditId: string
  clauseTitle: string
  positionText: string
  rungLabel: string
  legs?: ApprovalLeg[]
  approverUserId?: string
  approverGroupId?: string
  detail?: string
}) {
  try {
    const legs: ApprovalLeg[] = input.legs && input.legs.length > 0
      ? input.legs
      : input.approverUserId
        ? [{ userId: input.approverUserId }]
        : input.approverGroupId
          ? [{ groupId: input.approverGroupId }]
          : []
    const legsProblem = legError(legs)
    if (legsProblem) return { ok: false as const, error: legsProblem }
    // Escalations decide as one leg: the parent row carries the single
    // route. Multi-leg chains stay a plan-approval shape.
    if (legs.length > 1) return { ok: false as const, error: "Escalations route to one approver or group — one leg." }
    const first = legs[0] as ApprovalLeg
    const named = !!first.userId
    if (!UUID_RE.test(input.auditId)) return { ok: false as const, error: "Invalid deal." }
    const clauseTitle = input.clauseTitle.trim().slice(0, 120)
    if (!clauseTitle) return { ok: false as const, error: "Name the clause being escalated." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: VERIFY_REQUIRED_ERROR }
    const { data: audit } = await supabase
      .from("audits")
      .select("id, title")
      .eq("id", input.auditId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!audit) return { ok: false as const, error: "Deal not found." }

    const svc = await serviceClient()
    if (!svc) return { ok: false as const, error: "Service not configured." }
    if (first.userId) {
      if (first.userId === user.id) {
        return { ok: false as const, error: "Route to someone else — decide your own escalations directly." }
      }
      if (!(await approverEligible(svc, user.id, first.userId))) {
        return { ok: false as const, error: "Approvers must be an owner or admin of an organization you belong to." }
      }
    } else if (first.groupId) {
      const { data: group } = await svc
        .from("permission_groups")
        .select("id, org_id, name")
        .eq("id", first.groupId)
        .maybeSingle()
      if (!group) return { ok: false as const, error: "Group not found." }
      const { data: membership } = await svc
        .from("organization_members")
        .select("org_id")
        .eq("org_id", (group as { org_id: string }).org_id)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!membership) return { ok: false as const, error: "You can only route to groups of your own organizations." }
    }

    const title = `Escalation: ${clauseTitle}`
    const { data: live } = await supabase
      .from("approval_requests")
      .select("id")
      .eq("subject_type", "escalation")
      .eq("subject_id", input.auditId)
      .eq("title", title)
      .eq("verdict", "pending")
      .maybeSingle()
    if (live) return { ok: false as const, error: "That clause is already escalated — one live escalation at a time." }

    const detail = (input.detail
      ?? `Position: ${input.positionText.slice(0, 300)} — rung: ${input.rungLabel}. Ladder exhausted or flagged; needs a human call.`)
      .trim().slice(0, 1000)
    const { data: created, error } = await supabase
      .from("approval_requests")
      .insert({
        user_id: user.id,
        approver_user_id: named ? (first.userId as string) : null,
        approver_group_id: !named ? (first.groupId as string) : null,
        subject_type: "escalation",
        subject_id: input.auditId,
        title,
        detail: detail || "Clause escalation.",
      })
      .select("id")
      .single()
    if (error || !created) return { ok: false, error: "We couldn't file that escalation." }
    try {
      if (!named) {
        await notifyGroup(svc, first.groupId as string, user.id, {
          title: "Escalation requested",
          body: `${user.email ?? "A teammate"} escalated ${clauseTitle}: ${detail.slice(0, 200)}`,
        })
      } else {
        const { createNotification } = await import("@/lib/notifications/store")
        await createNotification(supabase, {
          userId: first.userId as string,
          type: "approval",
          category: "approval_requests",
          title: "Escalation requested",
          body: `${user.email ?? "A teammate"} escalated ${clauseTitle} for your call.`,
          link: "/approvals",
        })
      }
    } catch {
      // The request stands regardless; the notification is best-effort.
    }
    return { ok: true as const, id: (created as { id: string }).id }
  } catch (e) {
    return toActionFailure(e, "Could not file that escalation.") as never
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
      .select("id, user_id, approver_user_id, approver_group_id, subject_type, subject_id, title, verdict")
      .eq("id", input.requestId)
      .maybeSingle()
    const reqRow = req as { id: string; user_id: string; approver_user_id: string | null; approver_group_id: string | null; subject_type: string; subject_id: string; title: string; verdict: string } | null
    if (!reqRow) return { ok: false as const, error: "Request not found." }
    if (reqRow.user_id === user.id) {
      return { ok: false as const, error: "You can't decide your own request — not even through a group." }
    }
    if (reqRow.verdict !== "pending") return { ok: false as const, error: "That request is already decided — decisions are final." }
    if (reqRow.subject_type !== "plan" && reqRow.subject_type !== "escalation") {
      return { ok: false as const, error: "Unknown approval subject." }
    }

    const svc = await serviceClient()
    if (!svc) return { ok: false as const, error: "Service not configured." }
    const designated = reqRow.approver_user_id === user.id
    const viaGroup = reqRow.approver_group_id !== null
      && (await groupDeciderEligible(svc, reqRow.approver_group_id as string, user.id))
    // Third arm: live cover. The delegate inherits exactly the delegator's
    // reach on this request — nothing more.
    const cover = !designated && !viaGroup
      ? await delegationCovers(svc, user.id, { approver_user_id: reqRow.approver_user_id, approver_group_id: reqRow.approver_group_id })
      : null
    if (!designated && !viaGroup && !cover) {
      return { ok: false as const, error: "Only the designated approver, a member of the routed group, or their live cover can decide." }
    }
    if (designated && !(await approverEligible(svc, reqRow.user_id, user.id))) {
      return { ok: false as const, error: "You are no longer an approver for that teammate's organization." }
    }
    if (cover) {
      // Re-validate the chain at decide-time: the delegator must still
      // hold deciding power, and the cover must still belong to the org.
      const { data: membership } = await svc
        .from("organization_members")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(50)
      const myOrgs = new Set(((membership ?? []) as Array<{ org_id: string }>).map((m) => m.org_id))
      const { data: grant } = await svc
        .from("approval_delegations")
        .select("org_id, delegator")
        .eq("id", cover.id)
        .maybeSingle()
      const g = grant as { org_id: string; delegator: string } | null
      if (!g || !myOrgs.has(g.org_id)) {
        return { ok: false as const, error: "That cover no longer reaches this request." }
      }
      const granterDesignated = g.delegator === reqRow.approver_user_id
      const granterInGroup = reqRow.approver_group_id !== null
        && (await groupDeciderEligible(svc, reqRow.approver_group_id as string, g.delegator))
      if (!granterDesignated && !granterInGroup) {
        return { ok: false as const, error: "The granter lost deciding power — the cover lapses for this request." }
      }
      if (granterDesignated && !(await approverEligible(svc, reqRow.user_id, g.delegator))) {
        return { ok: false as const, error: "The granter lost deciding power — the cover lapses for this request." }
      }
    }

    if (reqRow.subject_type === "escalation") {
      // Verdict-only escalation: the eligibility above is the whole gate.
      // No plan seal, no step ledger, no execution side effects — the
      // frozen row is the record. First-writer-wins pin like plans.
      const decidedAt = new Date().toISOString()
      const { data: decided, error: decideError } = await supabase
        .from("approval_requests")
        .update({ verdict: input.verdict, comment: comment || null, decided_at: decidedAt })
        .eq("id", reqRow.id)
        .eq("verdict", "pending")
        .select("id")
      if (decideError) return { ok: false as const, error: "We couldn't record that decision." }
      if (!decided || (Array.isArray(decided) && decided.length === 0)) {
        return { ok: false as const, error: "Someone decided first — this request is already settled." }
      }
      try {
        await svc.from("activity_events").insert({
          user_id: reqRow.user_id,
          audit_id: reqRow.subject_id,
          event_type: "escalation_decided",
          payload: {
            request_id: reqRow.id,
            decided_by: user.id,
            on_behalf_of: cover ? cover.delegator : null,
            comment: comment || null,
          },
        })
      } catch {
        // Audit is best-effort; the frozen row is the record.
      }
      try {
        const { createNotification } = await import("@/lib/notifications/store")
        const deciderLabel = cover ? `${user.email ?? "A cover"} (on behalf)` : (user.email ?? "Your approver")
        await createNotification(svc, {
          userId: reqRow.user_id,
          type: "approval",
          category: "approval_requests",
          title: input.verdict === "approved" ? "Escalation accepted" : "Escalation sent back",
          body: input.verdict === "approved"
            ? `${deciderLabel} accepted “${reqRow.title}” — proceed on that call.`
            : `${deciderLabel} sent back “${reqRow.title}”: ${comment}`,
          link: "/approvals",
        })
      } catch {
        // The decision stands regardless; the notification is best-effort.
      }
      return { ok: true as const, verdict: input.verdict }
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
      return { ok: false as const, error: "That plan is gone — the request is closed." }
    }
    if (planRow.status !== "awaiting_approval") {
      return { ok: false as const, error: `That plan already moved to ${planRow.status} — nothing left to decide.` }
    }

    // Step ledger: which leg is live. Legacy single-leg requests (filed
    // before steps existed) carry no rows — the parent routing IS the
    // only leg and the flow below behaves exactly as before.
    const { data: stepRows } = await svc
      .from("approval_steps")
      .select("id, step_no, approver_user_id, approver_group_id, verdict")
      .eq("request_id", reqRow.id)
      .order("step_no", { ascending: true })
    const steps = ((stepRows ?? []) as Array<{
      id: string; step_no: number; approver_user_id: string | null; approver_group_id: string | null; verdict: string;
    }>)
    const liveStep = steps.find((s) => s.verdict === "pending") ?? null
    const totalSteps = steps.length
    const stepPosition = liveStep ? steps.filter((s) => s.step_no < liveStep.step_no && s.verdict === "approved").length + 1 : steps.length
    // Sanity: the live leg must match the parent cursor. A mismatch means
    // concurrent writers crossed — refuse rather than advance blindly.
    if (liveStep && (
      (liveStep.approver_user_id ?? null) !== reqRow.approver_user_id ||
      (liveStep.approver_group_id ?? null) !== reqRow.approver_group_id
    )) {
      return { ok: false, error: "That request changed mid-decision — reload and try again." }
    }

    const now = new Date().toISOString()
    // First-writer-wins: the pending pin means exactly one decider lands.
    // A 0-row update is a lost race (or a double-click), never success —
    // report it instead of duplicating side-effects below.
    if (input.verdict === "approved" && liveStep && steps.some((s) => s.step_no > liveStep.step_no)) {
      // Middle of the chain: record the leg, advance the cursor, keep the
      // parent pending. The plan does not move until the last leg lands.
      const { error: legError } = await svc
        .from("approval_steps")
        .update({ verdict: "approved", comment: comment || null, decided_by: user.id, decided_at: now })
        .eq("id", liveStep.id)
        .eq("verdict", "pending")
      if (legError) return { ok: false, error: "We couldn't record that decision." }
      const next = steps.filter((s) => s.step_no > liveStep.step_no).sort((a, b) => a.step_no - b.step_no)[0]!
      const { error: advanceError } = await svc
        .from("approval_requests")
        .update({ approver_user_id: next.approver_user_id, approver_group_id: next.approver_group_id })
        .eq("id", reqRow.id)
        .eq("verdict", "pending")
      if (advanceError) return { ok: false, error: "Step recorded, but the handoff failed — reload the queue." }
      try {
        await svc.from("activity_events").insert({
          user_id: planRow.user_id,
          audit_id: planRow.deal_id,
          event_type: "plan_step_approved",
          payload: {
            plan_id: planRow.id,
            request_id: reqRow.id,
            step_no: liveStep.step_no,
            steps_total: totalSteps,
            decided_by: user.id,
            on_behalf_of: cover ? cover.delegator : null,
            comment: comment || null,
          },
        })
      } catch {
        // Audit is best-effort; the frozen rows are the record.
      }
      try {
        if (next.approver_group_id) {
          await notifyGroup(svc, next.approver_group_id, planRow.user_id, {
            title: "Approval requested",
            body: `Step ${stepPosition + 1} of ${totalSteps} is yours: ${reqRow.title}`,
          })
        } else if (next.approver_user_id) {
          const { createNotification } = await import("@/lib/notifications/store")
          await createNotification(svc, {
            userId: next.approver_user_id,
            type: "approval",
            category: "approval_requests",
            title: "Approval requested",
            body: `Step ${stepPosition + 1} of ${totalSteps} is yours: ${reqRow.title}`,
            link: "/approvals",
          })
        }
      } catch {
        // The advance stands regardless; the notification is best-effort.
      }
      return { ok: true as const, verdict: "approved" as const, advanced: true as const, step: stepPosition, stepsTotal: totalSteps }
    }

    if (input.verdict === "rejected" && liveStep) {
      // A rejection ends the whole chain: void the legs that never ran.
      try {
        await svc
          .from("approval_steps")
          .update({ verdict: "skipped" })
          .eq("request_id", reqRow.id)
          .eq("verdict", "pending")
          .neq("id", liveStep.id)
      } catch {
        // Cosmetic; the parent verdict below is the record.
      }
    }

    const { data: decided, error: decideError } = await supabase
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
      .select("id")
    if (decideError) return { ok: false, error: "We couldn't record that decision." }
    if (!decided || (Array.isArray(decided) && decided.length === 0)) {
      return { ok: false, error: "Someone decided first — this request is already settled." }
    }
    if (liveStep) {
      try {
        await svc
          .from("approval_steps")
          .update({ verdict: input.verdict, comment: comment || null, decided_by: user.id, decided_at: now })
          .eq("id", liveStep.id)
          .eq("verdict", "pending")
      } catch {
        // Parent verdict above is the record; the leg row follows best-effort.
      }
    }

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
        payload: {
          plan_id: planRow.id,
          request_id: reqRow.id,
          decided_by: user.id,
          on_behalf_of: cover ? cover.delegator : null,
          delegation_id: cover ? cover.id : null,
          comment: comment || null,
        },
      })
    } catch {
      // Audit is best-effort; the frozen row is the record.
    }
    try {
      const { createNotification } = await import("@/lib/notifications/store")
      const deciderLabel = cover ? `${user.email ?? "A cover"} (on behalf)` : (user.email ?? "Your approver")
      await createNotification(svc, {
        userId: planRow.user_id,
        type: "approval",
        category: "approval_requests",
        title: input.verdict === "approved" ? "Plan approved" : "Plan rejected",
        body: input.verdict === "approved"
          ? `${deciderLabel} approved “${reqRow.title}” — it can execute now.`
          : `${deciderLabel} rejected “${reqRow.title}”: ${comment}`,
        link: "/approvals",
      })
      if (cover) {
        await createNotification(svc, {
          userId: cover.delegator,
          type: "approval",
          category: "approval_requests",
          title: `Cover decided: ${input.verdict}`,
          body: `${user.email ?? "Your cover"} ${input.verdict} “${reqRow.title}” on your behalf.`,
          link: "/approvals",
        })
      }
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
