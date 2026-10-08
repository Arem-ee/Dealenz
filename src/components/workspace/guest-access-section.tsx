"use client"

import { useEffect, useState } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { audienceLabel, type GuestAudience, type GuestScope } from "@/lib/guests/grants"
import {
  decideStagedUpload,
  inviteGuest,
  listGuestGrants,
  listStagedUploads,
  revokeGuestGrant,
  type GuestGrantView,
  type StagedUploadView,
} from "@/lib/deals/guests"

const AUDIENCES: GuestAudience[] = ["employee", "supplier", "customer"]
const SCOPES: GuestScope[] = ["reader", "commenter", "uploader"]

const SCOPE_LABEL: Record<GuestScope, string> = {
  reader: "Reader",
  commenter: "Commenter",
  uploader: "Uploader",
}

// External access: invitation-only token grants on the one guest surface.
// Readers read; one primary uploader per deal uploads redlines back staged;
// staged files enter version control only when the owner accepts them.
export function GuestAccessSection({ auditId }: { auditId: string }) {
  const { showError, showSuccess } = useToast()
  const [grants, setGrants] = useState<GuestGrantView[] | null>(null)
  const [staged, setStaged] = useState<StagedUploadView[] | null>(null)
  const [email, setEmail] = useState("")
  const [audience, setAudience] = useState<GuestAudience>("supplier")
  const [scope, setScope] = useState<GuestScope>("reader")
  const [primary, setPrimary] = useState(false)
  const [expiryDays, setExpiryDays] = useState("30")
  const [portalPath, setPortalPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deciding, setDeciding] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    Promise.all([listGuestGrants(auditId), listStagedUploads(auditId)])
      .then(([g, s]) => {
        if (!live) return
        if (!g.ok) showError(g.error, "External access failed to load")
        else setGrants(g.grants)
        if (!s.ok) showError(s.error, "Staged files failed to load")
        else setStaged(s.uploads)
        if (!g.ok) setGrants([])
        if (!s.ok) setStaged([])
      })
      .catch(() => {
        if (!live) return
        showError("External access failed to load")
        setGrants([])
        setStaged([])
      })
    return () => {
      live = false
    }
  }, [auditId, showError])

  async function refresh() {
    const [g, s] = await Promise.all([listGuestGrants(auditId), listStagedUploads(auditId)])
    if (g.ok) setGrants(g.grants)
    if (s.ok) setStaged(s.uploads)
  }

  async function invite() {
    if (busy || !email.trim()) return
    setBusy(true)
    setPortalPath(null)
    try {
      const days = expiryDays.trim() === "" ? null : Number(expiryDays)
      const res = await inviteGuest({
        auditId, email, audience, scope,
        primaryOwner: scope === "uploader" && primary,
        expiresInDays: days,
      })
      if (!res.ok) throw new Error(res.error)
      setPortalPath(res.portalPath)
      setEmail("")
      setPrimary(false)
      await refresh()
      showSuccess("External invited — share the portal link out of band.")
    } catch (err) {
      showError(err instanceof Error ? err.message : "Invite failed.")
    } finally {
      setBusy(false)
    }
  }

  async function revoke(grantId: string) {
    if (busy) return
    setBusy(true)
    try {
      const res = await revokeGuestGrant({ auditId, grantId })
      if (!res.ok) throw new Error(res.error)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Revoke failed.")
    } finally {
      setBusy(false)
    }
  }

  async function decide(uploadId: string, accept: boolean) {
    if (deciding) return
    setDeciding(uploadId)
    try {
      const res = await decideStagedUpload({ uploadId, accept })
      if (!res.ok) throw new Error(res.error)
      await refresh()
      showSuccess(accept ? `Filed${res.versionNumber ? ` as v${res.versionNumber}` : ""}.` : "Staged file rejected.")
    } catch (err) {
      showError(err instanceof Error ? err.message : "Decision failed.")
    } finally {
      setDeciding(null)
    }
  }

  const pending = (staged ?? []).filter((s) => s.status === "pending")

  return (
    <div className="border border-border p-3" aria-label="External access">
      <p className="text-[13px] font-semibold">External access</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Invite outsiders by email — they enter through one scoped portal, never as members.
      </p>

      {portalPath ? (
        <p role="status" className="mt-2 border border-border bg-muted px-2 py-1.5 font-mono text-[11px] break-all">
          {portalPath} — copy now, it shows once.
        </p>
      ) : null}

      <div className="mt-2 grid gap-1.5">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          placeholder="counsel@counterparty.com"
          aria-label="External email"
          className="h-9 w-full border border-input bg-background px-2 text-sm outline-none placeholder:text-muted-foreground/60"
        />
        <div className="flex flex-wrap gap-1.5" aria-label="Audience">
          {AUDIENCES.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={audience === a}
              onClick={() => setAudience(a)}
              className={cn(
                "border px-2 py-1 text-[11px] font-medium transition-colors",
                audience === a
                  ? "border-foreground bg-muted font-semibold text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {audienceLabel(a)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Scope">
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => {
                setScope(s)
                if (s === "reader") setPrimary(false)
              }}
              className={cn(
                "border px-2 py-1 text-[11px] font-medium transition-colors",
                scope === s
                  ? "border-foreground bg-muted font-semibold text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {SCOPE_LABEL[s]}
            </button>
          ))}
          {scope === "uploader" ? (
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={primary}
                onChange={(e) => setPrimary(e.target.checked)}
                className="h-3.5 w-3.5 accent-foreground"
              />
              Primary owner (one per deal)
            </label>
          ) : null}
        </div>
        <div className="flex gap-1.5">
          <input
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            placeholder="Expires in days (blank = open)"
            aria-label="Expires in days"
            inputMode="numeric"
            className="h-9 w-44 border border-input bg-background px-2 text-xs outline-none placeholder:text-muted-foreground/60"
          />
          <button
            type="button"
            onClick={() => void invite()}
            disabled={busy || !email.trim()}
            className="h-9 bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            Invite external
          </button>
        </div>
      </div>

      {grants === null ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading access…
        </p>
      ) : grants.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {grants.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 border-t border-border pt-1.5 text-xs">
              <span className="min-w-0 truncate">
                <span className="font-medium">{g.email}</span>{" "}
                <span className="text-muted-foreground">
                  · {audienceLabel(g.audience).toLowerCase()} · {g.scope}
                  {g.isPrimaryOwner ? " · primary" : ""}
                  {g.revokedAt ? " · revoked" : g.expiresAt ? ` · ends ${new Date(g.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : " · open"}
                </span>
              </span>
              {!g.revokedAt ? (
                <button
                  type="button"
                  aria-label={`Revoke access for ${g.email}`}
                  onClick={() => void revoke(g.id)}
                  disabled={busy}
                  className="shrink-0 p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {pending.length > 0 ? (
        <div className="mt-2 border-t border-border pt-2" aria-label="Staged counterparty files">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Staged redlines — outside version control until accepted
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {pending.map((s) => (
              <li key={s.id} className="border border-border px-2 py-1.5">
                <p className="truncate text-xs font-medium">{s.fileName}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  from {s.grantEmail || "counterparty"} · {(s.sizeBytes / 1024).toFixed(0)}KB
                </p>
                <div className="mt-1.5 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => void decide(s.id, true)}
                    disabled={deciding === s.id}
                    className="h-7 bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    Accept into new version
                  </button>
                  <button
                    type="button"
                    onClick={() => void decide(s.id, false)}
                    disabled={deciding === s.id}
                    className="h-7 border border-border px-2.5 text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
