"use client"

import { useEffect, useState } from "react"
import { Check, Plus, Trash2, Users } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import {
  addOrgGroupMember,
  createOrgGroup,
  grantOrgDelegation,
  listMyOrganizations,
  listOrgDelegations,
  listOrgGroups,
  removeOrgGroupMember,
  revokeOrgDelegation,
  type OrgDelegation,
  type OrgGroup,
} from "@/lib/orgs/actions"

const ROLE_COLUMNS = ["Owner", "Admin", "Member", "Viewer"] as const

// Rows: permission -> roles that hold it. This matrix is the design
// decision itself: small, plain-language roles; groups (not individuals)
// carry approvals and access; new members land lowest.
const MATRIX: Array<{ group: string; rows: Array<{ label: string; desc: string; holds: boolean[] }> }> = [
  {
    group: "Deals",
    rows: [
      { label: "View deals", desc: "See deals shared with you.", holds: [true, true, true, true] },
      { label: "Create deals", desc: "Start analyses, drafts, and threads.", holds: [true, true, true, false] },
      { label: "Delete deals", desc: "Remove deals and their history.", holds: [true, true, false, false] },
    ],
  },
  {
    group: "Documents & Signing",
    rows: [
      { label: "Generate documents", desc: "Produce drafts from deals.", holds: [true, true, true, false] },
      { label: "Send for signature", desc: "Start signing ceremonies.", holds: [true, true, true, false] },
      { label: "Sign as owner", desc: "Apply your own signature.", holds: [true, true, true, false] },
    ],
  },
  {
    group: "Approvals",
    rows: [
      { label: "Request approval", desc: "Raise decisions to the queue.", holds: [true, true, true, false] },
      { label: "Approve for the team", desc: "Decide others' requests.", holds: [true, true, false, false] },
      { label: "Manage approval rules", desc: "Set who must approve what.", holds: [true, true, false, false] },
    ],
  },
  {
    group: "Team & Billing",
    rows: [
      { label: "Invite members", desc: "Bring people in at Member or below.", holds: [true, true, false, false] },
      { label: "Manage roles & groups", desc: "Change roles, run groups.", holds: [true, true, false, false] },
      { label: "Manage billing", desc: "Credits, invoices, plans.", holds: [true, false, false, false] },
      { label: "Delete the workspace", desc: "Irreversible, confirmed twice.", holds: [true, false, false, false] },
    ],
  },
]

// Team foreground: roles matrix plus live groups. Groups are the routing
// fabric — approvals go to a group and any member decides. Owners and
// admins manage; members see.
export function TeamView() {
  const { showError, showSuccess } = useToast()
  const [groups, setGroups] = useState<OrgGroup[] | null>(null)
  const [delegations, setDelegations] = useState<OrgDelegation[] | null>(null)
  const [orgs, setOrgs] = useState<Array<{ orgId: string; orgName: string; role: string }>>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [coverOpen, setCoverOpen] = useState(false)
  const [coverOrgId, setCoverOrgId] = useState("")
  const [coverGroupId, setCoverGroupId] = useState("")
  const [coverEmail, setCoverEmail] = useState("")
  const [coverEnds, setCoverEnds] = useState("")
  const [spendOrgId, setSpendOrgId] = useState("")
  const [spend, setSpend] = useState<Array<{ userId: string; email: string; credits: number }> | null>(null)
  const [quotas, setQuotas] = useState<Array<{ userId: string; email: string; cap: number }>>([])
  const [quotaEmail, setQuotaEmail] = useState("")
  const [quotaCap, setQuotaCap] = useState("")
  const [newOrgId, setNewOrgId] = useState("")
  const [newName, setNewName] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [addEmail, setAddEmail] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      const [g, o, d] = await Promise.all([listOrgGroups(), listMyOrganizations(), listOrgDelegations()])
      if (!g.ok) {
        showError(g.error)
        setGroups([])
      } else {
        setGroups(g.groups)
      }
      if (!d.ok) {
        setDelegations([])
      } else {
        setDelegations(d.delegations)
      }
      if (o.ok) {
        setOrgs(o.orgs)
        if (o.orgs.length > 0 && !newOrgId) {
          const manageable = o.orgs.find((x) => x.role === "owner" || x.role === "admin")
          setNewOrgId((manageable ?? o.orgs[0]!).orgId)
        }
        if (o.orgs.length > 0 && !coverOrgId) {
          const manageable = o.orgs.find((x) => x.role === "owner" || x.role === "admin")
          setCoverOrgId((manageable ?? o.orgs[0]!).orgId)
        }
      }
    } catch {
      showError("Team failed to load")
      setGroups([])
      setDelegations([])
    }
  }

  useEffect(() => {
    let live = true
    Promise.all([listOrgGroups(), listMyOrganizations(), listOrgDelegations()])
      .then(([g, o, d]) => {
        if (!live) return
        if (!g.ok) {
          showError(g.error)
          setGroups([])
        } else {
          setGroups(g.groups)
        }
        setDelegations(d.ok ? d.delegations : [])
        if (o.ok) {
          setOrgs(o.orgs)
          const manageable = o.orgs.find((x) => x.role === "owner" || x.role === "admin")
          if (manageable) {
            setNewOrgId(manageable.orgId)
            setCoverOrgId(manageable.orgId)
          } else if (o.orgs.length > 0) {
            setNewOrgId(o.orgs[0]!.orgId)
            setCoverOrgId(o.orgs[0]!.orgId)
          }
        }
      })
      .catch(() => {
        if (!live) return
        showError("Team failed to load")
        setGroups([])
        setDelegations([])
      })
    return () => {
      live = false
    }
  }, [showError])

  async function create() {
    if (busy || !newOrgId || !newName.trim()) return
    setBusy(true)
    try {
      const res = await createOrgGroup(newOrgId, newName)
      if (!res.ok) throw new Error(res.error)
      showSuccess("Group created.")
      setCreateOpen(false)
      setNewName("")
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't create that group.")
    } finally {
      setBusy(false)
    }
  }

  async function add(groupId: string) {
    const email = (addEmail[groupId] ?? "").trim()
    if (busy || !email) return
    setBusy(true)
    try {
      const res = await addOrgGroupMember(groupId, email)
      if (!res.ok) throw new Error(res.error)
      showSuccess("Added to group.")
      setAddEmail((prev) => ({ ...prev, [groupId]: "" }))
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't add that member.")
    } finally {
      setBusy(false)
    }
  }

  async function remove(groupId: string, userId: string) {
    if (busy) return
    setBusy(true)
    try {
      const res = await removeOrgGroupMember(groupId, userId)
      if (!res.ok) throw new Error(res.error)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't remove that member.")
    } finally {
      setBusy(false)
    }
  }

  async function grant() {
    if (busy || !coverOrgId || !coverEmail.trim()) return
    setBusy(true)
    try {
      const res = await grantOrgDelegation({
        orgId: coverOrgId,
        groupId: coverGroupId || null,
        email: coverEmail,
        endsAt: coverEnds || null,
      })
      if (!res.ok) throw new Error(res.error)
      showSuccess("Cover granted.")
      setCoverOpen(false)
      setCoverEmail("")
      setCoverEnds("")
      setCoverGroupId("")
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't grant that cover.")
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    if (busy) return
    setBusy(true)
    try {
      const res = await revokeOrgDelegation(id)
      if (!res.ok) throw new Error(res.error)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't end that cover.")
    } finally {
      setBusy(false)
    }
  }

  async function loadSpend(orgId: string) {
    setSpendOrgId(orgId)
    if (!orgId) {
      setSpend(null)
      setQuotas([])
      return
    }
    try {
      const { getOrgSpend } = await import("@/lib/billing/subscription-actions")
      const { listMemberQuotas } = await import("@/lib/orgs/actions")
      const [spendRes, quotaRes] = await Promise.all([getOrgSpend(orgId), listMemberQuotas(orgId)])
      if (!spendRes.ok) throw new Error(spendRes.error)
      setSpend(spendRes.spend)
      setQuotas(quotaRes.ok ? quotaRes.quotas : [])
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't load pool spend.")
      setSpend([])
    }
  }

  async function setQuota() {
    if (busy || !spendOrgId || !quotaEmail.trim() || !quotaCap.trim()) return
    setBusy(true)
    try {
      const { setMemberQuota } = await import("@/lib/orgs/actions")
      const res = await setMemberQuota(spendOrgId, quotaEmail, Number(quotaCap))
      if (!res.ok) throw new Error(res.error)
      showSuccess("Quota set — enforced on the next reservation.")
      setQuotaEmail("")
      setQuotaCap("")
      await loadSpend(spendOrgId)
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't set that quota.")
    } finally {
      setBusy(false)
    }
  }

  async function removeQuota(userId: string) {
    if (busy || !spendOrgId) return
    setBusy(true)
    try {
      const { removeMemberQuota } = await import("@/lib/orgs/actions")
      const res = await removeMemberQuota(spendOrgId, userId)
      if (!res.ok) throw new Error(res.error)
      await loadSpend(spendOrgId)
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't remove that quota.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-y-auto px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Team</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Members, groups, and who can do what.
          </p>
        </div>
        <span className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground opacity-40" aria-disabled="true">
          <Plus className="h-3.5 w-3.5" />
          Invite
        </span>
      </div>

      <section aria-label="Members" className="shrink-0">
        <h2 className="text-sm font-semibold">Members</h2>
        <div className="mt-2 border border-dashed px-4 py-10 text-center">
          <Users className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Only you here — so far</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Invites land here with role and status, newest first. Inviting wires up with this tab&apos;s functions.
          </p>
        </div>
      </section>

      <section aria-label="Groups" className="mt-6 shrink-0">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Groups</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Reusable sets of people — approvals go to a group and any member decides.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="inline-flex h-8 shrink-0 items-center gap-1 border border-border px-3 text-[11px] font-medium hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            New group
          </button>
        </div>

        {createOpen && (
          <div className="mt-2 border border-border bg-background p-3" aria-label="Create a group">
            <label className="block text-[11px] font-medium text-muted-foreground" htmlFor="group-org">Organization</label>
            <select
              id="group-org"
              value={newOrgId}
              onChange={(e) => setNewOrgId(e.target.value)}
              disabled={busy}
              className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm disabled:opacity-60"
            >
              <option value="">Pick an organization…</option>
              {orgs.map((o) => (
                <option key={o.orgId} value={o.orgId}>{o.orgName} · {o.role}</option>
              ))}
            </select>
            <label className="mt-2 block text-[11px] font-medium text-muted-foreground" htmlFor="group-name">
              Group name
            </label>
            <div className="mt-1 flex gap-1.5">
              <input
                id="group-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={busy}
                autoComplete="off"
                placeholder="Finance, Legal, Founders…"
                className="h-9 min-w-0 flex-1 border border-input bg-background px-2 text-sm outline-none disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void create()}
                disabled={busy || !newOrgId || !newName.trim()}
                className="h-9 shrink-0 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
              >
                Create
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Owners and admins only — enforced server-side.</p>
          </div>
        )}

        <div className="mt-2">
          {groups === null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading groups…</p>
          ) : groups.length === 0 ? (
            <div className="border border-dashed px-4 py-10 text-center">
              <p className="text-sm font-medium">No groups yet</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                Finance, Legal, Founders — group once, route approvals to the group forever.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {groups.map((g) => (
                <li key={g.groupId} className="border border-border bg-background">
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => (prev === g.groupId ? null : g.groupId))}
                    aria-expanded={expanded === g.groupId}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{g.name}</span>
                      <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
                        {g.orgName} · {g.members.length} member{g.members.length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>
                  {expanded === g.groupId && (
                    <div className="border-t border-border px-3.5 py-3">
                      {g.members.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Empty — add the first decider below.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {g.members.map((m) => (
                            <li key={m.userId} className="flex items-center gap-2 text-[13px]">
                              <span className="min-w-0 flex-1 truncate">{m.email || m.userId}</span>
                              {g.canManage && (
                                <button
                                  type="button"
                                  onClick={() => void remove(g.groupId, m.userId)}
                                  disabled={busy}
                                  aria-label={`Remove ${m.email || m.userId} from ${g.name}`}
                                  className="shrink-0 p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {g.canManage ? (
                        <div className="mt-2 flex gap-1.5">
                          <input
                            value={addEmail[g.groupId] ?? ""}
                            onChange={(e) => setAddEmail((prev) => ({ ...prev, [g.groupId]: e.target.value }))}
                            disabled={busy}
                            placeholder="colleague@example.com"
                            aria-label={`Add member email for ${g.name}`}
                            autoComplete="off"
                            className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none disabled:opacity-60"
                          />
                          <button
                            type="button"
                            onClick={() => void add(g.groupId)}
                            disabled={busy || !(addEmail[g.groupId] ?? "").trim()}
                            className="h-8 shrink-0 border border-border px-2.5 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] text-muted-foreground">Only owners and admins manage groups.</p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-label="Coverage" className="mt-6 shrink-0">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Coverage</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Hand your deciding power to a teammate for a window — they decide as your cover, never as themselves.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCoverOpen((v) => !v)}
            className="inline-flex h-8 shrink-0 items-center gap-1 border border-border px-3 text-[11px] font-medium hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            Grant cover
          </button>
        </div>

        {coverOpen && (
          <div className="mt-2 border border-border bg-background p-3" aria-label="Grant cover">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-[11px] font-medium text-muted-foreground">
                Organization
                <select value={coverOrgId} onChange={(e) => { setCoverOrgId(e.target.value); setCoverGroupId("") }} disabled={busy} className="mt-1 h-9 w-full border border-input bg-background px-2 text-xs text-foreground disabled:opacity-60">
                  <option value="">Pick an organization…</option>
                  {orgs.map((o) => (
                    <option key={o.orgId} value={o.orgId}>{o.orgName} · {o.role}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] font-medium text-muted-foreground">
                Scope <span className="font-normal">(blank covers everything)</span>
                <select value={coverGroupId} onChange={(e) => setCoverGroupId(e.target.value)} disabled={busy || !coverOrgId} className="mt-1 h-9 w-full border border-input bg-background px-2 text-xs text-foreground disabled:opacity-60">
                  <option value="">Everything</option>
                  {(groups ?? []).filter((g) => g.orgId === coverOrgId).map((g) => (
                    <option key={g.groupId} value={g.groupId}>{g.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] font-medium text-muted-foreground">
                Cover email
                <input value={coverEmail} onChange={(e) => setCoverEmail(e.target.value)} disabled={busy} autoComplete="off" placeholder="colleague@example.com" className="mt-1 h-9 w-full border border-input bg-background px-2 text-xs text-foreground outline-none disabled:opacity-60" />
              </label>
              <label className="block text-[11px] font-medium text-muted-foreground">
                Ends <span className="font-normal">(blank means open-ended)</span>
                <input value={coverEnds} onChange={(e) => setCoverEnds(e.target.value)} disabled={busy} type="date" className="mt-1 h-9 w-full border border-input bg-background px-2 text-xs text-foreground outline-none disabled:opacity-60" />
              </label>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void grant()}
                disabled={busy || !coverOrgId || !coverEmail.trim()}
                className="inline-flex h-9 items-center bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
              >
                Grant cover
              </button>
              <button
                type="button"
                onClick={() => setCoverOpen(false)}
                className="inline-flex h-9 items-center px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Owners and admins only. Covers never stack — a cover cannot hand power onward — and never reach your own requests.
            </p>
          </div>
        )}

        <div className="mt-2">
          {delegations === null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading coverage…</p>
          ) : delegations.length === 0 ? (
            <div className="border border-dashed px-4 py-10 text-center">
              <p className="text-sm font-medium">No cover in place</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                Vacations stop stalling approvals — grant cover before you go.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {delegations.map((d) => (
                <li key={d.id} className="flex items-center gap-2 border border-border bg-background px-3.5 py-2.5 text-[13px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {d.mine ? "You" : (d.delegatorEmail || d.delegator.slice(0, 8))} → {d.delegateEmail || d.delegate.slice(0, 8)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {d.orgName}{d.groupName ? ` · ${d.groupName} only` : " · everything"}
                      {d.endsAt ? ` · until ${new Date(d.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : " · open-ended"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void revoke(d.id)}
                    disabled={busy}
                    className="shrink-0 border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    End
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-label="Pool spend" className="mt-6 shrink-0">
        <h2 className="text-sm font-semibold">Pool spend</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Who spent what from the shared pool — read-only.
        </p>
        <div className="mt-2">
          <label className="block text-[11px] font-medium text-muted-foreground" htmlFor="spend-org">Organization</label>
          <select
            id="spend-org"
            value={spendOrgId}
            onChange={(e) => void loadSpend(e.target.value)}
            className="mt-1 h-9 w-full max-w-xs border border-input bg-background px-2 text-sm"
          >
            <option value="">Pick an organization…</option>
            {orgs.map((o) => (
              <option key={o.orgId} value={o.orgId}>{o.orgName} · {o.role}</option>
            ))}
          </select>
          {spend !== null && spendOrgId !== "" && (
            spend.length === 0 && quotas.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No pool spend yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {spend.map((s) => {
                  const quota = quotas.find((q) => q.userId === s.userId)
                  const canManage = (orgs.find((o) => o.orgId === spendOrgId)?.role === "owner" || orgs.find((o) => o.orgId === spendOrgId)?.role === "admin")
                  return (
                    <li key={s.userId} className="border border-border bg-background px-3 py-2 text-[13px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate">{s.email || s.userId}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {s.credits} credits{quota ? ` / ${quota.cap} cap` : ""}
                        </span>
                        {canManage && quota && (
                          <button
                            type="button"
                            onClick={() => void removeQuota(s.userId)}
                            disabled={busy}
                            aria-label={`Remove quota for ${s.email || s.userId}`}
                            className="shrink-0 text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-50"
                          >
                            Uncap
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
                {quotas.filter((q) => !spend.some((s) => s.userId === q.userId)).map((q) => (
                  <li key={q.userId} className="flex items-center justify-between gap-2 border border-border bg-background px-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">{q.email || q.userId}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">0 / {q.cap} cap</span>
                  </li>
                ))}
              </ul>
            )
          )}
          {spendOrgId !== "" && (orgs.find((o) => o.orgId === spendOrgId)?.role === "owner" || orgs.find((o) => o.orgId === spendOrgId)?.role === "admin") && (
            <div className="mt-2 border border-border p-2.5" aria-label="Set a quota">
              <p className="text-[11px] font-medium">Cap a member <span className="font-normal text-muted-foreground">(rolling 30 days, pool spend only)</span></p>
              <div className="mt-1.5 flex gap-1.5">
                <input
                  value={quotaEmail}
                  onChange={(e) => setQuotaEmail(e.target.value)}
                  disabled={busy}
                  placeholder="colleague@example.com"
                  aria-label="Member email"
                  autoComplete="off"
                  className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none disabled:opacity-60"
                />
                <input
                  value={quotaCap}
                  onChange={(e) => setQuotaCap(e.target.value.replace(/[^0-9]/g, "").slice(0, 7))}
                  disabled={busy}
                  inputMode="numeric"
                  placeholder="Credits"
                  aria-label="Quota in credits"
                  className="h-8 w-24 shrink-0 border border-input bg-background px-2 text-xs outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void setQuota()}
                  disabled={busy || !quotaEmail.trim() || !quotaCap.trim()}
                  className="h-8 shrink-0 border border-border px-2.5 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
                >
                  Set
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section aria-label="Roles" className="mt-6 shrink-0">
        <h2 className="text-sm font-semibold">Roles</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Small and plain-language. New members land lowest; destructive powers stay at the top.
        </p>
        <div className="mt-2 overflow-x-auto border border-border">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-semibold">Permission</th>
                {ROLE_COLUMNS.map((r) => (
                  <th key={r} scope="col" className="px-3 py-2 text-center font-semibold">{r}</th>
                ))}
              </tr>
            </thead>
            {MATRIX.map((g) => (
              <tbody key={g.group} className="border-b border-border last:border-b-0">
                <tr>
                  <td colSpan={5} className="bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.group}
                  </td>
                </tr>
                {g.rows.map((row) => (
                  <tr key={row.label} className="border-t border-border/60">
                    <td className="px-3 py-2">
                      <span className="block text-[13px] font-medium">{row.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{row.desc}</span>
                    </td>
                    {row.holds.map((has, i) => (
                      <td key={ROLE_COLUMNS[i]} className="px-3 py-2 text-center">
                        {has ? (
                          <Check className="mx-auto h-4 w-4 text-foreground" aria-label="Included" />
                        ) : (
                          <span className="text-muted-foreground" aria-label="Not included">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>
    </div>
  )
}
