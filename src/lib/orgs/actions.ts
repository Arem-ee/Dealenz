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
