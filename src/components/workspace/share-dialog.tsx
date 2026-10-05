"use client"

import { useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import {
  listApprovalGroups,
} from "@/lib/approvals/actions"
import {
  listDealShares,
  setShareExpiry,
  setShareScope,
  shareDealWithGroup,
  unshareDealWithGroup,
  type DealShareView,
  type ShareScope,
} from "@/lib/deals/shares"

// Share dialog: the owner shares this deal with a group (read-only for
// members); revoke co-located. Shared viewers see the dialog closed —
// shares are owner-managed, never self-granted.
export function ShareDialog({ auditId, shared }: { auditId: string; shared: boolean }) {
  const { showError, showSuccess } = useToast()
  const [open, setOpen] = useState(false)
  const [shares, setShares] = useState<DealShareView[] | null>(null)
  const [groups, setGroups] = useState<Array<{ groupId: string; name: string }>>([])
  const [groupId, setGroupId] = useState("")
  const [expiry, setExpiry] = useState("")
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const [s, g] = await Promise.all([listDealShares(auditId), listApprovalGroups()])
      if (!s.ok) {
        showError(s.error)
        setShares([])
      } else {
        setShares(s.shares)
      }
      if (g.ok) {
        setGroups(g.groups.map((x) => ({ groupId: x.groupId, name: x.name })))
        if (g.groups.length > 0 && !groupId) setGroupId(g.groups[0]!.groupId)
      }
    } catch {
      showError("Sharing failed to load")
      setShares([])
    }
  }

  useEffect(() => {
    if (!open || shared) return
    let live = true
    Promise.all([listDealShares(auditId), listApprovalGroups()])
      .then(([s, g]) => {
        if (!live) return
        if (!s.ok) {
          showError(s.error)
          setShares([])
        } else {
          setShares(s.shares)
        }
        if (g.ok) {
          setGroups(g.groups.map((x) => ({ groupId: x.groupId, name: x.name })))
          if (g.groups.length > 0) setGroupId((prev) => prev || g.groups[0]!.groupId)
        }
      })
      .catch(() => {
        if (!live) return
        showError("Sharing failed to load")
        setShares([])
      })
    return () => {
      live = false
    }
  }, [open, shared, auditId, showError])

  async function share() {
    if (busy || !groupId) return
    setBusy(true)
    try {
      const res = await shareDealWithGroup(auditId, groupId, expiry || null)
      if (!res.ok) throw new Error(res.error)
      showSuccess("Deal shared — members read, only you can change.")
      setGroupId("")
      setExpiry("")
      await load()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't share that deal.")
    } finally {
      setBusy(false)
    }
  }

  async function changeExpiry(id: string, value: string | null) {
    if (busy) return
    setBusy(true)
    try {
      const res = await setShareExpiry(auditId, id, value)
      if (!res.ok) throw new Error(res.error)
      setShares((prev) => prev?.map((s) => (s.groupId === id ? {
        ...s,
        expiresAt: value ? new Date(value).toISOString() : null,
      } : s)) ?? null)
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't change that expiry.")
    } finally {
      setBusy(false)
    }
  }
  async function revoke(id: string) {
    if (busy) return
    setBusy(true)
    try {
      const res = await unshareDealWithGroup(auditId, id)
      if (!res.ok) throw new Error(res.error)
      await load()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't revoke that share.")
    } finally {
      setBusy(false)
    }
  }

  async function changeScope(id: string, scope: ShareScope) {
    if (busy) return
    setBusy(true)
    try {
      const res = await setShareScope(auditId, id, scope)
      if (!res.ok) throw new Error(res.error)
      setShares((prev) => prev?.map((s) => (s.groupId === id ? { ...s, scope } : s)) ?? null)
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't change that scope.")
    } finally {
      setBusy(false)
    }
  }

  if (shared) return null

  return (
    <div className="border border-border bg-background p-4" aria-label="Sharing">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sharing{shares !== null && shares.length > 0 ? ` · ${shares.length} group${shares.length === 1 ? "" : "s"}` : ""}
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          {open ? "Close" : shares !== null && shares.length > 0 ? "Manage" : "Share"}
        </button>
      </div>
      {open && (
        <div className="mt-2">
          {shares === null ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : shares.length === 0 ? (
            <p className="text-xs text-muted-foreground">Only you can open this deal. Share it with a group for read-only access.</p>
          ) : (
            <ul className="space-y-1.5">
              {shares.map((s) => (
                <li key={s.groupId} className="border-b border-border/60 pb-1.5 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-1.5 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">
                      {s.groupName ?? "Group"}
                      {s.orgName && <span className="text-muted-foreground"> · {s.orgName}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => void revoke(s.groupId)}
                      disabled={busy}
                      aria-label={`Revoke share with ${s.groupName ?? "group"}`}
                      className="shrink-0 p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <select
                      value={s.scope}
                      onChange={(e) => void changeScope(s.groupId, e.target.value as ShareScope)}
                      disabled={busy}
                      aria-label={`Access for ${s.groupName ?? "group"}`}
                      className="h-7 shrink-0 border border-input bg-background px-1 text-[11px] disabled:opacity-60"
                    >
                      <option value="viewer">View</option>
                      <option value="commenter">Comment</option>
                      <option value="asker">Ask</option>
                      <option value="participant">Ask + comment</option>
                    </select>
                    <input
                      type="date"
                      value={s.expiresAt ? s.expiresAt.slice(0, 10) : ""}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => void changeExpiry(s.groupId, e.target.value || null)}
                      disabled={busy}
                      aria-label={`Share expiry for ${s.groupName ?? "group"}`}
                      title={s.expiresAt ? `Expires ${new Date(s.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} — clear to keep open` : "No expiry — pick a date to time-box"}
                      className="h-7 min-w-0 flex-1 border border-input bg-background px-1 text-[11px] disabled:opacity-60"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-1.5">
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              disabled={busy}
              aria-label="Group to share with"
              className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-xs disabled:opacity-60"
            >
              <option value="">Pick a group…</option>
              {groups.filter((g) => !(shares ?? []).some((s) => s.groupId === g.groupId)).map((g) => (
                <option key={g.groupId} value={g.groupId}>{g.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={expiry}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setExpiry(e.target.value)}
              disabled={busy}
              aria-label="Share expiry (optional)"
              title="Optional — leave blank for open access"
              className="h-8 w-32 shrink-0 border border-input bg-background px-1.5 text-xs disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void share()}
              disabled={busy || !groupId}
              className="h-8 shrink-0 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              Share
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Members read everything, change nothing. Revoke anytime — or set an expiry and access lapses itself.</p>
        </div>
      )}
    </div>
  )
}
