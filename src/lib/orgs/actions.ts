"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { toActionFailure } from "@/lib/action-result"
import { canInvite, isOrgRole, type OrgRole } from "@/lib/orgs/roles"

export interface OrgMembership {
  orgId: string
  orgName: string
  role: OrgRole
}

export interface OrgRosterMember {
  userId: string
  email: string
  role: string
}

/** Roster of one org the caller belongs to, with emails for display. */
export async function listOrgMembers(
  orgId: string,
  page = 1
): Promise<{ ok: true; members: OrgRosterMember[]; myRole: string | null } | { ok: false; error: string }> {
  try {
    if (!isUUID(orgId)) return { ok: false as const, error: "Invalid organization." }
    const safePage = Number.isInteger(page) && page >= 1 && page <= 20 ? page : 1
    const PAGE_SIZE = 50
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const svc = createServiceClient(url, key)
    const { data: mine } = await svc
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!mine) return { ok: false as const, error: "Not a member of that organization." }
    const myRole = (mine as { role: string }).role
    const privileged = myRole === "owner" || myRole === "admin"
    const { data: members } = await svc
      .from("organization_members")
      .select("user_id, role")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true })
      .range((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE - 1)
    const rows = ((members ?? []) as Array<{ user_id: string; role: string }>)
    const emails = new Map<string, string>()
    if (privileged) {
      try {
        // Owner/admin only: resolve display emails page by page instead of a
        // 200-user blanket dump.
        const { data: listed } = await svc.auth.admin.listUsers({ page: safePage, perPage: PAGE_SIZE })
        for (const u of ((listed as { users?: Array<{ id: string; email?: string }> } | null)?.users ?? [])) {
          emails.set(u.id, u.email ?? "")
        }
      } catch {
        // Ids still identify rows; emails are display-only.
      }
    }
    try {
      await svc.from("activity_events").insert({
        user_id: user.id,
        type: "org_roster_viewed",
        details: { org_id: orgId, page: safePage, privileged },
      })
    } catch {
      // Audit is best-effort.
    }
    return {
      ok: true as const,
      members: rows.map((m) => ({
        userId: m.user_id,
        email: privileged ? (emails.get(m.user_id) ?? "") : m.user_id === user.id ? (emails.get(m.user_id) ?? "") : "",
        role: m.role,
      })),
      myRole,
    }
  } catch (e) {
    return toActionFailure(e, "We couldn't load members.") as never
  }
}

export interface OrgDelegation {
  id: string
  orgId: string
  orgName: string
  groupId: string | null
  groupName: string | null
  delegator: string
  delegate: string
  delegateEmail: string
  delegatorEmail: string
  startsAt: string
  endsAt: string | null
  isActive: boolean
  mine: boolean
}

export interface OrgMemberQuota {
  userId: string
  email: string
  cap: number
}

/** Quotas for an org's members, with emails resolved for management. */
export async function listMemberQuotas(
  orgId: string
): Promise<{ ok: true; quotas: OrgMemberQuota[] } | { ok: false; error: string }> {
  try {
    if (!isUUID(orgId)) return { ok: false as const, error: "Invalid organization." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const { data, error } = await supabase
      .from("member_quotas")
      .select("user_id, cap_credits")
      .eq("org_id", orgId)
      .limit(200)
    if (error) {
      if (error.message.includes("member_quotas")) {
        return { ok: false as const, error: "Quotas need a database update (migration 00108). Please try again after migrating." }
      }
      throw new Error(error.message)
    }
    const rows = ((data ?? []) as Array<{ user_id: string; cap_credits: number }>)
    const emails = new Map<string, string>()
    if (rows.length > 0) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && key) {
        try {
          const svc = createServiceClient(url, key)
          const { data: listed } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
          for (const u of ((listed as { users?: Array<{ id: string; email?: string }> } | null)?.users ?? [])) {
            emails.set(u.id, u.email ?? "")
          }
        } catch {
          // Ids still identify rows; emails are display-only.
        }
      }
    }
    return {
      ok: true as const,
      quotas: rows.map((r) => ({ userId: r.user_id, email: emails.get(r.user_id) ?? "", cap: r.cap_credits })),
    }
  } catch (e) {
    return toActionFailure(e, "We couldn't load quotas.") as never
  }
}

export async function setMemberQuota(
  orgId: string,
  email: string,
  cap: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isUUID(orgId)) return { ok: false as const, error: "Invalid organization." }
    const clean = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false as const, error: "Enter a valid email." }
    if (!Number.isInteger(cap) || cap <= 0) return { ok: false as const, error: "Quota must be a positive credit amount." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Please verify your email address first." }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const svc = createServiceClient(url, key)
    const { data: listed, error: listError } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (listError) return { ok: false as const, error: "We couldn't find that account. Please try again." }
    const target = ((((listed as unknown as { users?: Array<{ id: string; email?: string }> }).users) ?? []).find((u) => (u.email ?? "").toLowerCase() === clean))
    if (!target) return { ok: false as const, error: "No Dealenz account uses that email yet." }
    const { data, error } = await supabase.rpc("set_member_quota", { p_org_id: orgId, p_user_id: target.id, p_cap: cap })
    if (error) {
      if (error.message.includes("member_quotas")) {
        return { ok: false as const, error: "Quotas need a database update (migration 00108). Please try again after migrating." }
      }
      return { ok: false as const, error: "We couldn't set that quota. Please try again." }
    }
    const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
    if (!row?.success) return { ok: false as const, error: row?.message ?? "We couldn't set that quota." }
    return { ok: true as const }
  } catch (e) {
    return toActionFailure(e, "We couldn't set that quota.") as never
  }
}

export async function removeMemberQuota(
  orgId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isUUID(orgId) || !isUUID(userId)) return { ok: false as const, error: "Invalid quota." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const { data, error } = await supabase.rpc("remove_member_quota", { p_org_id: orgId, p_user_id: userId })
    if (error) return { ok: false as const, error: "We couldn't remove that quota." }
    const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
    if (!row?.success) return { ok: false as const, error: row?.message ?? "We couldn't remove that quota." }
    return { ok: true as const }
  } catch (e) {
    return toActionFailure(e, "We couldn't remove that quota.") as never
  }
}

/** Coverage across the caller's orgs, with names resolved for display. */
export async function listOrgDelegations(): Promise<{ ok: true; delegations: OrgDelegation[] } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const svc = createServiceClient(url, key)
    const { data: mine } = await svc.from("organization_members").select("org_id, role").eq("user_id", user.id)
    const myOrgs = ((mine ?? []) as Array<{ org_id: string; role: string }>)
    if (myOrgs.length === 0) return { ok: true as const, delegations: [] }
    const roleByOrg = new Map(myOrgs.map((m) => [m.org_id, m.role]))
    const { data: orgs } = await svc.from("organizations").select("id, name").in("id", [...roleByOrg.keys()])
    const orgNames = new Map(((orgs ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]))
    const { data: rows } = await svc
      .from("approval_delegations")
      .select("id, org_id, group_id, delegator, delegate, starts_at, ends_at, is_active")
      .in("org_id", [...roleByOrg.keys()])
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(100)
    const delegations = ((rows ?? []) as Array<{
      id: string; org_id: string; group_id: string | null; delegator: string;
      delegate: string; starts_at: string; ends_at: string | null; is_active: boolean;
    }>)
    const groupIds = [...new Set(delegations.map((d) => d.group_id).filter((v): v is string => v !== null))]
    const groupNames = new Map<string, string>()
    if (groupIds.length > 0) {
      const { data: groups } = await svc.from("permission_groups").select("id, name").in("id", groupIds)
      for (const g of ((groups ?? []) as Array<{ id: string; name: string }>)) groupNames.set(g.id, g.name)
    }
    const emails = new Map<string, string>()
    try {
      const { data: listed } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
      for (const u of ((listed as { users?: Array<{ id: string; email?: string }> } | null)?.users ?? [])) {
        emails.set(u.id, u.email ?? "")
      }
    } catch {
      // Emails are display-only.
    }
    return {
      ok: true as const,
      delegations: delegations.map((d) => ({
        id: d.id,
        orgId: d.org_id,
        orgName: orgNames.get(d.org_id) ?? "Organization",
        groupId: d.group_id,
        groupName: d.group_id ? (groupNames.get(d.group_id) ?? null) : null,
        delegator: d.delegator,
        delegate: d.delegate,
        delegateEmail: emails.get(d.delegate) ?? "",
        delegatorEmail: emails.get(d.delegator) ?? "",
        startsAt: d.starts_at,
        endsAt: d.ends_at,
        isActive: d.is_active,
        mine: d.delegator === user.id,
      })),
    }
  } catch (e) {
    return toActionFailure(e, "We couldn't load coverage.") as never
  }
}

export async function grantOrgDelegation(input: {
  orgId: string
  groupId?: string | null
  email: string
  endsAt?: string | null
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    if (!isUUID(input.orgId)) return { ok: false as const, error: "Invalid organization." }
    if (input.groupId !== undefined && input.groupId !== null && !isUUID(input.groupId)) {
      return { ok: false as const, error: "Invalid group." }
    }
    const clean = input.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false as const, error: "Enter a valid email." }
    let endsAt: string | null = null
    if (input.endsAt) {
      const t = new Date(input.endsAt).getTime()
      if (Number.isNaN(t) || t <= Date.now()) return { ok: false as const, error: "Coverage must end in the future." }
      endsAt = new Date(t).toISOString()
    }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Please verify your email address first." }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const svc = createServiceClient(url, key)
    const { data: listed, error: listError } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (listError) return { ok: false as const, error: "We couldn't find that account. Please try again." }
    const target = ((((listed as unknown as { users?: Array<{ id: string; email?: string }> }).users) ?? []).find((u) => (u.email ?? "").toLowerCase() === clean))
    if (!target) return { ok: false as const, error: "No Dealenz account uses that email yet." }
    const { data, error } = await supabase.rpc("grant_approval_delegation", {
      p_org_id: input.orgId,
      p_group_id: input.groupId ?? null,
      p_delegate: target.id,
      p_ends_at: endsAt,
    })
    if (error) {
      if (error.message.includes("approval_delegation")) {
        return { ok: false as const, error: "Coverage needs a database update (migration 00099). Please try again after migrating." }
      }
      return { ok: false as const, error: "We couldn't grant that coverage. Please try again." }
    }
    const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string; id?: string } | null
    if (!row?.success || !row.id) return { ok: false as const, error: row?.message ?? "We couldn't grant that coverage." }
    try {
      const { createNotification } = await import("@/lib/notifications/store")
      await createNotification(svc, {
        userId: target.id,
        type: "approval",
        title: "Approval cover granted",
        body: `${user.email ?? "A teammate"} handed you approval cover${endsAt ? ` until ${new Date(endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}.`,
        link: "/approvals",
        category: "approval_requests",
      })
    } catch {
      // The grant stands regardless; the notification is best-effort.
    }
    return { ok: true as const, id: String(row.id) }
  } catch (e) {
    return toActionFailure(e, "We couldn't grant that coverage.") as never
  }
}

export async function revokeOrgDelegation(
  delegationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isUUID(delegationId)) return { ok: false as const, error: "Invalid coverage." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const { data, error } = await supabase.rpc("revoke_approval_delegation", { p_delegation_id: delegationId })
    if (error) return { ok: false as const, error: "We couldn't end that coverage." }
    const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
    if (!row?.success) return { ok: false as const, error: row?.message ?? "We couldn't end that coverage." }
    return { ok: true as const }
  } catch (e) {
    return toActionFailure(e, "We couldn't end that coverage.") as never
  }
}

export interface OrgGroup {
  groupId: string
  orgId: string
  orgName: string
  name: string
  members: Array<{ userId: string; email: string }>
  canManage: boolean
}

/** Groups across the caller's orgs, with member emails for management. */
export async function listOrgGroups(): Promise<{ ok: true; groups: OrgGroup[] } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const svc = createServiceClient(url, key)
    const { data: mine } = await svc.from("organization_members").select("org_id, role").eq("user_id", user.id)
    const myOrgs = ((mine ?? []) as Array<{ org_id: string; role: string }>)
    if (myOrgs.length === 0) return { ok: true as const, groups: [] }
    const roleByOrg = new Map(myOrgs.map((m) => [m.org_id, m.role]))
    const { data: orgs } = await svc.from("organizations").select("id, name").in("id", [...roleByOrg.keys()])
    const orgNames = new Map(((orgs ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]))
    const { data: groups } = await svc
      .from("permission_groups")
      .select("id, org_id, name")
      .in("org_id", [...roleByOrg.keys()])
      .order("name", { ascending: true })
      .limit(100)
    const groupRows = ((groups ?? []) as Array<{ id: string; org_id: string; name: string }>)
    if (groupRows.length === 0) return { ok: true as const, groups: [] }
    const { data: members } = await svc
      .from("permission_group_members")
      .select("group_id, user_id")
      .in("group_id", groupRows.map((g) => g.id))
      .limit(500)
    const emails = new Map<string, string>()
    try {
      const { data: listed } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
      for (const u of ((listed as { users?: Array<{ id: string; email?: string }> } | null)?.users ?? [])) {
        emails.set(u.id, u.email ?? "")
      }
    } catch {
      // Emails are display-only; management works on ids.
    }
    const byGroup = new Map<string, Array<{ userId: string; email: string }>>()
    for (const m of ((members ?? []) as Array<{ group_id: string; user_id: string }>)) {
      if (!byGroup.has(m.group_id)) byGroup.set(m.group_id, [])
      byGroup.get(m.group_id)!.push({ userId: m.user_id, email: emails.get(m.user_id) ?? "" })
    }
    return {
      ok: true as const,
      groups: groupRows.map((g) => ({
        groupId: g.id,
        orgId: g.org_id,
        orgName: orgNames.get(g.org_id) ?? "Organization",
        name: g.name,
        members: byGroup.get(g.id) ?? [],
        canManage: roleByOrg.get(g.org_id) === "owner" || roleByOrg.get(g.org_id) === "admin",
      })),
    }
  } catch (e) {
    return toActionFailure(e, "We couldn't load groups.") as never
  }
}

export async function createOrgGroup(
  orgId: string,
  name: string
): Promise<{ ok: true; groupId: string } | { ok: false; error: string }> {
  try {
    if (!isUUID(orgId)) return { ok: false as const, error: "Invalid organization." }
    const clean = name.trim().slice(0, 120)
    if (!clean) return { ok: false as const, error: "Name the group first." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Please verify your email address first." }
    const { data, error } = await supabase.rpc("create_permission_group", { p_org_id: orgId, p_name: clean })
    if (error) {
      if (error.message.includes("permission_group")) {
        return { ok: false as const, error: "Groups need a database update (migration 00098). Please try again after migrating." }
      }
      return { ok: false as const, error: "We couldn't create that group. Please try again." }
    }
    const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null
    if (!row?.id) return { ok: false as const, error: "We couldn't create that group. Please try again." }
    return { ok: true as const, groupId: String(row.id) }
  } catch (e) {
    return toActionFailure(e, "We couldn't create that group.") as never
  }
}

export async function addOrgGroupMember(
  groupId: string,
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isUUID(groupId)) return { ok: false as const, error: "Invalid group." }
    const clean = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false as const, error: "Enter a valid email." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Please verify your email address first." }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const svc = createServiceClient(url, key)
    const { data: listed, error: listError } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (listError) return { ok: false as const, error: "We couldn't find that account. Please try again." }
    const target = ((((listed as unknown as { users?: Array<{ id: string; email?: string }> }).users) ?? []).find((u) => (u.email ?? "").toLowerCase() === clean))
    if (!target) return { ok: false as const, error: "No Dealenz account uses that email yet. They need to register and join the organization first." }
    const { data, error } = await supabase.rpc("add_permission_group_member", { p_group_id: groupId, p_user_id: target.id })
    if (error) {
      if (error.message.includes("permission_group")) {
        return { ok: false as const, error: "Groups need a database update (migration 00098). Please try again after migrating." }
      }
      return { ok: false as const, error: "We couldn't add that member. Please try again." }
    }
    const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
    if (!row?.success) return { ok: false as const, error: row?.message ?? "We couldn't add that member." }
    return { ok: true as const }
  } catch (e) {
    return toActionFailure(e, "We couldn't add that member.") as never
  }
}

export async function removeOrgGroupMember(
  groupId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isUUID(groupId) || !isUUID(userId)) return { ok: false as const, error: "Invalid member." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const { data, error } = await supabase.rpc("remove_permission_group_member", { p_group_id: groupId, p_user_id: userId })
    if (error) return { ok: false as const, error: "We couldn't remove that member." }
    const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
    if (!row?.success) return { ok: false as const, error: row?.message ?? "We couldn't remove that member." }
    return { ok: true as const }
  } catch (e) {
    return toActionFailure(e, "We couldn't remove that member.") as never
  }
}

function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

export async function listMyOrganizations(): Promise<{ ok: true; orgs: OrgMembership[] } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const { data, error } = await supabase
      .from("organization_members")
      .select("role, org_id, organizations!inner(id, name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
    if (error) {
      if (error.message.includes("organization_members") || error.message.includes("organizations")) {
        return { ok: true as const, orgs: [] }
      }
      return { ok: false as const, error: "We couldn't load your organizations. Please try again." }
    }
    const orgs = ((data ?? []) as unknown as Array<{ role: string; org_id: string; organizations: { id: string; name: string } | null }>)
      .filter((r) => r.organizations && isOrgRole(r.role))
      .map((r) => ({ orgId: String(r.organizations!.id), orgName: String(r.organizations!.name), role: r.role as OrgRole }))
    return { ok: true as const, orgs }
  } catch (e) {
    return toActionFailure(e, "We couldn't load your organizations.") as never
  }
}

export async function createOrganization(
  name: string
): Promise<{ ok: true; orgId: string } | { ok: false; error: string }> {
  try {
    const clean = name.trim().slice(0, 120)
    if (!clean) return { ok: false as const, error: "Name your organization first." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Please verify your email address first." }
    const { data, error } = await supabase.rpc("create_organization", { p_name: clean })
    if (error) {
      if (error.message.includes("create_organization")) {
        return { ok: false as const, error: "Organizations need a database update (migration 00091). Please try again after migrating." }
      }
      return { ok: false as const, error: "We couldn't create that organization. Please try again." }
    }
    const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null
    if (!row?.id) return { ok: false as const, error: "We couldn't create that organization. Please try again." }
    return { ok: true as const, orgId: String(row.id) }
  } catch (e) {
    return toActionFailure(e, "We couldn't create that organization.") as never
  }
}

export async function inviteOrganizationMember(
  orgId: string,
  email: string,
  role: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isUUID(orgId)) return { ok: false as const, error: "Invalid organization." }
    const cleanEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return { ok: false as const, error: "Enter a valid email." }
    if (!isOrgRole(role) || role === "owner") return { ok: false as const, error: "Role must be admin, member, or viewer." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const { data: mine } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()
    const acting = (mine as { role?: unknown } | null)?.role
    if (!isOrgRole(acting) || !canInvite(acting, role)) {
      return { ok: false as const, error: "Only organization owners and admins can invite members." }
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { ok: false as const, error: "Service not configured." }
    const svc = createServiceClient(url, key)
    const { data: listed, error: listError } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (listError) return { ok: false as const, error: "We couldn't find that account. Please try again." }
    const target = (listed.users ?? []).find((u) => (u.email ?? "").toLowerCase() === cleanEmail)
    if (!target) return { ok: false as const, error: "No Dealenz account uses that email yet. They need to register first." }
    const { data, error } = await supabase.rpc("add_organization_member", {
      p_org_id: orgId,
      p_user_id: target.id,
      p_role: role,
    })
    if (error) {
      if (error.message.includes("add_organization_member")) {
        return { ok: false as const, error: "Organizations need a database update (migration 00091). Please try again after migrating." }
      }
      return { ok: false as const, error: "We couldn't add that member. Please try again." }
    }
    const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
    if (!row?.success) return { ok: false as const, error: row?.message ?? "We couldn't add that member." }
    return { ok: true as const }
  } catch (e) {
    return toActionFailure(e, "We couldn't add that member.") as never
  }
}

export async function removeOrganizationMember(
  orgId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!isUUID(orgId) || !isUUID(userId)) return { ok: false as const, error: "Invalid member." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const { data, error } = await supabase.rpc("remove_organization_member", {
      p_org_id: orgId,
      p_user_id: userId,
    })
    if (error) {
      if (error.message.includes("remove_organization_member")) {
        return { ok: false as const, error: "Organizations need a database update (migration 00091). Please try again after migrating." }
      }
      return { ok: false as const, error: "We couldn't remove that member. Please try again." }
    }
    const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
    if (!row?.success) return { ok: false as const, error: row?.message ?? "We couldn't remove that member." }
    return { ok: true as const }
  } catch (e) {
    return toActionFailure(e, "We couldn't remove that member.") as never
  }
}
