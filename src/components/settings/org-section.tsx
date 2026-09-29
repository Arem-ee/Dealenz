"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import {
  createOrganization,
  inviteOrganizationMember,
  listMyOrganizations,
  removeOrganizationMember,
  type OrgMembership,
} from "@/lib/orgs/actions"
import { ORG_ROLES, type OrgRole } from "@/lib/orgs/roles"

export function OrgSection() {
  const { showError } = useToast()
  const [orgs, setOrgs] = useState<OrgMembership[] | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({})
  const [inviteRole, setInviteRole] = useState<Record<string, Exclude<OrgRole, "owner">>>({})
  const [busy, setBusy] = useState(false)

  async function refresh() {
    try {
      const res = await listMyOrganizations()
      if (!res.ok) {
        showError(res.error)
        setOrgs([])
        return
      }
      setOrgs(res.orgs)
    } catch {
      setOrgs([])
    }
  }

  useEffect(() => {
    let cancelled = false
    listMyOrganizations()
      .then((res) => {
        if (cancelled) return
        if (!res.ok) {
          showError(res.error)
          setOrgs([])
          return
        }
        setOrgs(res.orgs)
      })
      .catch(() => {
        if (!cancelled) setOrgs([])
      })
    return () => {
      cancelled = true
    }
  }, [showError])

  async function handleCreate() {
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      const res = await createOrganization(newName.trim())
      if (!res.ok) {
        showError(res.error, "Organization not created")
        return
      }
      setNewName("")
      setExpandedId(res.orgId)
      await refresh()
    } catch {
      showError("We couldn't create that organization. Please try again.")
    } finally {
      setCreating(false)
    }
  }

  async function handleInvite(orgId: string) {
    if (busy) return
    const email = (inviteEmail[orgId] ?? "").trim()
    if (!email) return
    setBusy(true)
    try {
      const res = await inviteOrganizationMember(orgId, email, inviteRole[orgId] ?? "member")
      if (!res.ok) {
        showError(res.error, "Invite failed")
        return
      }
      setInviteEmail((s) => ({ ...s, [orgId]: "" }))
      await refresh()
    } catch {
      showError("We couldn't add that member. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(orgId: string, userId: string, self: boolean) {
    if (busy) return
    if (!window.confirm(self ? "Leave this organization?" : "Remove this member?")) return
    setBusy(true)
    try {
      const res = await removeOrganizationMember(orgId, userId)
      if (!res.ok) {
        showError(res.error, "Not removed")
        return
      }
      await refresh()
    } catch {
      showError("We couldn't remove that member. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Organizations</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Group seats under one roof. Sharing deals inside an organization arrives next; membership works today.
        </p>
      </div>

      {orgs === null ? (
        <p className="text-xs text-muted-foreground">Loading your organizations…</p>
      ) : orgs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          No organizations yet. Create one to start inviting your team.
        </p>
      ) : (
        <ul className="space-y-2">
          {orgs.map((o) => (
            <li key={o.orgId} className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setExpandedId((id) => (id === o.orgId ? null : o.orgId))}
                aria-expanded={expandedId === o.orgId}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.orgName}</span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                  {o.role}
                </span>
              </button>
              {expandedId === o.orgId && (
                <div className="space-y-3 border-t border-border/60 px-4 py-3">
                  {(o.role === "owner" || o.role === "admin") && (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <div className="min-w-0 flex-1">
                          <Label htmlFor={`invite-${o.orgId}`} className="sr-only">Member email</Label>
                          <Input
                            id={`invite-${o.orgId}`}
                            value={inviteEmail[o.orgId] ?? ""}
                            onChange={(e) => setInviteEmail((s) => ({ ...s, [o.orgId]: e.target.value }))}
                            placeholder="teammate@company.com"
                            type="email"
                            className="h-9"
                          />
                        </div>
                        <label className="sr-only" htmlFor={`role-${o.orgId}`}>Role</label>
                        <select
                          id={`role-${o.orgId}`}
                          value={inviteRole[o.orgId] ?? "member"}
                          onChange={(e) => setInviteRole((s) => ({ ...s, [o.orgId]: e.target.value as Exclude<OrgRole, "owner"> }))}
                          className="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          {ORG_ROLES.filter((r) => r !== "owner").map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <Button size="sm" className="h-9 shrink-0" disabled={busy} onClick={() => void handleInvite(o.orgId)}>
                          Invite
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">They need a Dealenz account first. Owners are appointed, never invited.</p>
                    </div>
                  )}
                  <OrgMembers orgId={o.orgId} onRemove={(userId, self) => void handleRemove(o.orgId, userId, self)} busy={busy} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor="new-org" className="sr-only">New organization name</Label>
          <Input
            id="new-org"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Acme Legal"
            maxLength={120}
            className="h-9"
          />
        </div>
        <Button size="sm" className="h-9 shrink-0" disabled={creating || !newName.trim()} onClick={() => void handleCreate()}>
          {creating ? "Creating…" : "New organization"}
        </Button>
      </div>
    </div>
  )
}

function OrgMembers({ orgId, onRemove, busy }: { orgId: string; onRemove: (userId: string, self: boolean) => void; busy: boolean }) {
  const [rows, setRows] = useState<Array<{ user_id: string; role: string }> | null>(null)

  useEffect(() => {
    let cancelled = false
    import("@/lib/supabase/client").then(async ({ createClient }) => {
      try {
        const { data } = await createClient()
          .from("organization_members")
          .select("user_id, role")
          .eq("org_id", orgId)
          .order("created_at", { ascending: true })
        if (!cancelled) setRows(((data ?? []) as Array<{ user_id: string; role: string }>))
      } catch {
        if (!cancelled) setRows([])
      }
    })
    return () => {
      cancelled = true
    }
  }, [orgId])

  if (rows === null) return <p className="text-[11px] text-muted-foreground">Loading members…</p>
  if (rows.length === 0) return null
  return (
    <ul className="space-y-1">
      {rows.map((m) => (
        <li key={m.user_id} className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate font-mono">{m.user_id.slice(0, 8)}…</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
            {m.role}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRemove(m.user_id, false)}
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  )
}
