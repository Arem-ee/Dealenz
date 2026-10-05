"use server"

import { createClient } from "@/lib/supabase/server"
import { toActionFailure } from "@/lib/action-result"

// Deal sharing (phase 1: read-only). The owner shares a deal with a group;
// members read the thread, documents, and findings — every mutation keeps
// its user_id chain and stays owner-only by construction. Revoke deletes
// the row; history is untouched.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface DealShareView {
  groupId: string
  groupName: string | null
  orgName: string | null
}

/** Audit ids shared with the caller through group membership. */
export async function sharedAuditIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("deal_shares")
      .select("deal_id, group_id")
      .limit(200)
    const rows = ((data ?? []) as Array<{ deal_id: string; group_id: string }>)
    if (rows.length === 0) return []
    // RLS already narrows to visible shares; confirm membership per
    // group so revoked members drop out even before policy propagation.
    const { data: memberships } = await supabase
      .from("permission_group_members")
      .select("group_id")
      .eq("user_id", userId)
      .limit(200)
    const mine = new Set(((memberships ?? []) as Array<{ group_id: string }>).map((m) => m.group_id))
    return [...new Set(rows.filter((r) => mine.has(r.group_id)).map((r) => r.deal_id))]
  } catch {
    return []
  }
}

export async function listDealShares(auditId: string) {
  try {
    if (!UUID_RE.test(auditId)) return { ok: false as const, error: "Invalid deal." }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const { data, error } = await supabase
      .from("deal_shares")
      .select("group_id")
      .eq("deal_id", auditId)
      .limit(50)
    if (error) {
      if (error.message.includes("deal_shares")) {
        return { ok: false as const, error: "Sharing needs a database update (migration 00104). Please try again after migrating." }
      }
      throw new Error(error.message)
    }
    const groupIds = ((data ?? []) as Array<{ group_id: string }>).map((r) => r.group_id)
    const names = new Map<string, { name: string; org: string }>()
    if (groupIds.length > 0) {
      const { data: groups } = await supabase
        .from("permission_groups")
        .select("id, name, org_id")
        .in("id", groupIds)
      const orgIds = [...new Set(((groups ?? []) as Array<{ org_id: string }>).map((g) => g.org_id))]
      const orgNames = new Map<string, string>()
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase.from("organizations").select("id, name").in("id", orgIds)
        for (const o of ((orgs ?? []) as Array<{ id: string; name: string }>)) orgNames.set(o.id, o.name)
      }
      for (const g of ((groups ?? []) as Array<{ id: string; name: string; org_id: string }>)) {
        names.set(g.id, { name: g.name, org: orgNames.get(g.org_id) ?? "" })
      }
    }
    const shares: DealShareView[] = groupIds.map((id) => ({
      groupId: id,
      groupName: names.get(id)?.name ?? null,
      orgName: names.get(id)?.org ?? null,
    }))
    return { ok: true as const, shares }
  } catch (e) {
    return toActionFailure(e, "Could not load sharing.") as never
  }
}

export async function shareDealWithGroup(auditId: string, groupId: string) {
  try {
    if (!UUID_RE.test(auditId) || !UUID_RE.test(groupId)) {
      return { ok: false as const, error: "Invalid deal or group." }
    }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    if (!user.email_confirmed_at) return { ok: false as const, error: "Verify your email first." }
    const { data, error } = await supabase.rpc("share_deal_with_group", { p_deal_id: auditId, p_group_id: groupId })
    if (error) {
      if (error.message.includes("share_deal_with_group")) {
        return { ok: false as const, error: "Sharing needs a database update (migration 00104). Please try again after migrating." }
      }
      return { ok: false as const, error: "We couldn't share that deal." }
    }
    const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
    if (!row?.success) return { ok: false as const, error: row?.message ?? "We couldn't share that deal." }
    try {
      const { data: audit } = await supabase.from("audits").select("title").eq("id", auditId).eq("user_id", user.id).maybeSingle()
      const title = ((audit as { title?: string | null } | null)?.title?.trim() ? (audit as { title: string }).title : "Untitled")
      const svcUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (svcUrl && svcKey) {
        const { createClient: createServiceClient } = await import("@supabase/supabase-js")
        const svc = createServiceClient(svcUrl, svcKey)
        const { data: members } = await svc
          .from("permission_group_members")
          .select("user_id")
          .eq("group_id", groupId)
          .limit(50)
        const { createNotification } = await import("@/lib/notifications/store")
        for (const m of ((members ?? []) as Array<{ user_id: string }>)) {
          if (m.user_id === user.id) continue
          try {
            await createNotification(svc, {
              userId: m.user_id,
              type: "status",
              title: "Deal shared with your group",
              body: `${user.email ?? "A teammate"} shared “${title}” — open it read-only from Home.`,
              link: "/dashboard",
            })
          } catch {
            // One missed member never blocks the rest.
          }
        }
      }
    } catch {
      // The share stands regardless; the notification is best-effort.
    }
    return { ok: true as const }
  } catch (e) {
    return toActionFailure(e, "We couldn't share that deal.") as never
  }
}

export async function unshareDealWithGroup(auditId: string, groupId: string) {
  try {
    if (!UUID_RE.test(auditId) || !UUID_RE.test(groupId)) {
      return { ok: false as const, error: "Invalid deal or group." }
    }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: "You must be signed in." }
    const { data, error } = await supabase.rpc("unshare_deal_with_group", { p_deal_id: auditId, p_group_id: groupId })
    if (error) return { ok: false as const, error: "We couldn't revoke that share." }
    const row = (Array.isArray(data) ? data[0] : data) as { success?: boolean; message?: string } | null
    if (!row?.success) return { ok: false as const, error: row?.message ?? "We couldn't revoke that share." }
    return { ok: true as const }
  } catch (e) {
    return toActionFailure(e, "We couldn't revoke that share.") as never
  }
}
