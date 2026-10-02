"use client"

import { useEffect, useState } from "react"
import { Check, Copy, PenLine, Plus, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import {
  addSigner,
  listCeremonies,
  revokeSigner,
  signAsOwnerAction,
  startCeremony,
  type Ceremony,
} from "@/app/(app)/signing/actions"
import { listDrafts, type DraftVersionRow } from "@/app/(app)/drafts/actions"

type StatusFilter = "all" | "active" | "signed"

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function copyLink(path: string) {
  const url = `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`
  if (navigator.clipboard) {
    void navigator.clipboard.writeText(url).catch(() => window.prompt("Copy this link:", url))
  } else {
    window.prompt("Copy this link:", url)
  }
}

// Signing: ceremonies with progress, token links, owner signing,
// correct-after-send (add/revoke), and the sealed certificate.
export function SigningView() {
  const { showError } = useToast()
  const [ceremonies, setCeremonies] = useState<Ceremony[] | null>(null)
  const [status, setStatus] = useState<StatusFilter>("all")
  const [setupOpen, setSetupOpen] = useState(false)
  const [versions, setVersions] = useState<DraftVersionRow[] | null>(null)
  const [versionId, setVersionId] = useState("")
  const [recipients, setRecipients] = useState<Array<{ name: string; email: string }>>([{ name: "", email: "" }])
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [addRow, setAddRow] = useState<Record<string, { name: string; email: string }>>({})

  const refresh = async () => {
    try {
      const res = await listCeremonies()
      if (!res.ok) {
        showError(res.error, "Signing failed to load")
        setCeremonies([])
        return
      }
      setCeremonies(res.ceremonies)
    } catch {
      showError("Signing failed to load")
      setCeremonies([])
    }
  }

  useEffect(() => {
    let live = true
    listCeremonies()
      .then((res) => {
        if (!live) return
        if (!res.ok) {
          showError(res.error, "Signing failed to load")
          setCeremonies([])
          return
        }
        setCeremonies(res.ceremonies)
      })
      .catch(() => {
        if (!live) return
        showError("Signing failed to load")
        setCeremonies([])
      })
    return () => {
      live = false
    }
  }, [showError])

  async function openSetup() {
    setSetupOpen(true)
    setError(null)
    if (versions === null) {
      try {
        const res = await listDrafts()
        if (res.ok) {
          const draftVersions = res.drafts.filter((d) => (d.status ?? "draft") === "draft")
          setVersions(draftVersions)
          if (draftVersions.length > 0 && !versionId) setVersionId(draftVersions[0]!.id)
        }
      } catch {
        // Setup lists versions best-effort; start validates server-side.
      }
    }
  }

  async function start() {
    if (busy || !versionId) return
    setBusy(true)
    setError(null)
    try {
      const res = await startCeremony({
        versionId,
        signers: recipients.filter((r) => r.name.trim() || r.email.trim()),
        message,
      })
      if (!res.ok) throw new Error(res.error)
      setSetupOpen(false)
      setRecipients([{ name: "", email: "" }])
      setMessage("")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start signing.")
    } finally {
      setBusy(false)
    }
  }

  async function ownerSign(signerId: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await signAsOwnerAction({ signerId })
      if (!res.ok) throw new Error(res.error)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record that signature.")
      showError(err instanceof Error ? err.message : "Couldn't record that signature.")
    } finally {
      setBusy(false)
    }
  }

  async function add(versionIdValue: string) {
    const row = addRow[versionIdValue] ?? { name: "", email: "" }
    if (busy || !row.name.trim() || !row.email.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await addSigner({ versionId: versionIdValue, name: row.name, email: row.email })
      if (!res.ok) throw new Error(res.error)
      setAddRow((prev) => ({ ...prev, [versionIdValue]: { name: "", email: "" } }))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that signer.")
    } finally {
      setBusy(false)
    }
  }

  async function revoke(signerId: string) {
    if (busy) return
    setBusy(true)
    try {
      const res = await revokeSigner({ signerId })
      if (!res.ok) throw new Error(res.error)
      await refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't revoke that invitation.")
    } finally {
      setBusy(false)
    }
  }

  const visible = (ceremonies ?? []).filter((c) => {
    if (status === "all") return true
    if (status === "signed") return c.status === "locked" || c.status === "fully_signed"
    return c.status !== "locked" && c.status !== "fully_signed" && c.status !== "superseded"
  })

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-y-auto px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Signing</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Owner signs first, counterparties follow — links need no account.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openSetup()}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Send for signature
        </button>
      </div>

      {setupOpen && (
        <div className="mb-4 border border-border bg-background p-4" aria-label="Start a ceremony">
          <p className="text-sm font-semibold">Start a ceremony</p>
          <label className="mt-2 block text-[11px] font-medium text-muted-foreground" htmlFor="ceremony-version">Draft document</label>
          <select
            id="ceremony-version"
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
            disabled={busy}
            className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm disabled:opacity-60"
          >
            <option value="">Pick a draft…</option>
            {(versions ?? []).map((v) => (
              <option key={v.id} value={v.id}>{v.dealTitle} — {v.familyTitle} v{v.versionNumber}</option>
            ))}
          </select>
          <div className="mt-3 space-y-1.5" aria-label="Counterparties">
            {recipients.map((r, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  value={r.name}
                  onChange={(e) => setRecipients((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  disabled={busy}
                  placeholder="Full name"
                  aria-label={`Counterparty ${i + 1} name`}
                  autoComplete="off"
                  className="h-9 min-w-0 flex-1 border border-input bg-background px-2 text-sm outline-none disabled:opacity-60"
                />
                <input
                  value={r.email}
                  onChange={(e) => setRecipients((prev) => prev.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                  disabled={busy}
                  placeholder="email@example.com"
                  aria-label={`Counterparty ${i + 1} email`}
                  autoComplete="off"
                  className="h-9 min-w-0 flex-1 border border-input bg-background px-2 text-sm outline-none disabled:opacity-60"
                />
                {recipients.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove row"
                    onClick={() => setRecipients((prev) => prev.filter((_, j) => j !== i))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRecipients((prev) => [...prev, { name: "", email: "" }])}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              + Add another counterparty
            </button>
          </div>
          <label className="mt-3 block text-[11px] font-medium text-muted-foreground" htmlFor="ceremony-message">
            Message <span className="font-normal">(optional)</span>
          </label>
          <input
            id="ceremony-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy}
            autoComplete="off"
            placeholder="Please review and sign"
            className="mt-1 h-9 w-full border border-input bg-background px-2 text-sm outline-none disabled:opacity-60"
          />
          {error && <p role="alert" className="mt-2 border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void start()}
              disabled={busy || !versionId}
              className="inline-flex h-9 items-center bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              Start ceremony
            </button>
            <button
              type="button"
              onClick={() => setSetupOpen(false)}
              className="inline-flex h-9 items-center px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-4" aria-label="Filter ceremonies">
        {(["all", "active", "signed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={cn(
              "border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
              status === s
                ? "border-foreground bg-muted font-semibold text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "all" ? "All" : s === "active" ? "In flight" : "Signed"}
          </button>
        ))}
      </div>

      {ceremonies === null ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading ceremonies…</p>
      ) : visible.length === 0 ? (
        <div className="border border-dashed px-4 py-12 text-center">
          <PenLine className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No ceremonies in flight</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Start one from a draft — you sign first, counterparties follow through links that need no account.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((c) => (
            <li key={c.versionId} className="border border-border bg-background">
              <button
                type="button"
                onClick={() => setExpanded((prev) => (prev === c.versionId ? null : c.versionId))}
                aria-expanded={expanded === c.versionId}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.dealTitle} — {c.familyTitle} v{c.versionNumber}</span>
                  <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
                    {c.progress.signed} of {c.progress.total} signed · {c.status.replaceAll("_", " ")}
                    {c.progress.blocked ? " · needs attention" : ""}
                  </span>
                </span>
                {c.status === "locked" || c.status === "fully_signed" ? (
                  <Check className="h-4 w-4 shrink-0 text-pine-700" aria-label="Sealed" />
                ) : null}
              </button>

              {expanded === c.versionId && (
                <div className="border-t border-border px-3.5 py-3">
                  {c.message && <p className="text-xs text-muted-foreground">“{c.message}”</p>}
                  <ul className="mt-2 space-y-1.5">
                    {c.signers.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-[13px]">
                        <span className="min-w-0 flex-1 truncate">
                          {s.name} <span className="text-muted-foreground">· {s.isOwner ? "owner" : s.email} · {s.status}</span>
                          {s.signedAt && <span className="text-muted-foreground"> · {formatDate(s.signedAt)}</span>}
                        </span>
                        {s.status === "pending" && s.link && (
                          <button
                            type="button"
                            onClick={() => {
                              copyLink(s.link!)
                              setCopied(s.id)
                              window.setTimeout(() => setCopied((prev) => (prev === s.id ? null : prev)), 1500)
                            }}
                            aria-label={`Copy signing link for ${s.name}`}
                            className="flex shrink-0 items-center gap-1 text-muted-foreground hover:text-foreground"
                          >
                            {copied === s.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            <span className="text-[11px]">{copied === s.id ? "Copied" : "Copy link"}</span>
                          </button>
                        )}
                        {s.status === "pending" && s.isOwner && (
                          <button
                            type="button"
                            onClick={() => void ownerSign(s.id)}
                            disabled={busy}
                            className="shrink-0 bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                          >
                            Sign
                          </button>
                        )}
                        {s.status === "pending" && !s.isOwner && (
                          <button
                            type="button"
                            onClick={() => void revoke(s.id)}
                            disabled={busy}
                            aria-label={`Revoke invitation for ${s.name}`}
                            className="shrink-0 p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>

                  {!["locked", "fully_signed", "superseded"].includes(c.status) && (
                    <div className="mt-2 flex gap-1.5">
                      <input
                        value={addRow[c.versionId]?.name ?? ""}
                        onChange={(e) => setAddRow((prev) => ({ ...prev, [c.versionId]: { name: e.target.value, email: prev[c.versionId]?.email ?? "" } }))}
                        placeholder="Name"
                        aria-label="New signer name"
                        autoComplete="off"
                        className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none"
                      />
                      <input
                        value={addRow[c.versionId]?.email ?? ""}
                        onChange={(e) => setAddRow((prev) => ({ ...prev, [c.versionId]: { name: prev[c.versionId]?.name ?? "", email: e.target.value } }))}
                        placeholder="email@example.com"
                        aria-label="New signer email"
                        autoComplete="off"
                        className="h-8 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void add(c.versionId)}
                        disabled={busy}
                        className="h-8 shrink-0 border border-border px-2.5 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  )}

                  {(c.status === "locked" || c.status === "fully_signed") && (
                    <div className="mt-2 border border-border bg-muted/40 px-2.5 py-2 text-[11px]" aria-label="Certificate">
                      <p className="font-semibold">Sealed against edits.</p>
                      {c.sealHash && <p className="mt-0.5 break-all font-mono text-muted-foreground">seal {c.sealHash.slice(0, 32)}…</p>}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
        Drawn signatures arrive next — typed full names sign today. Links never expire yet; revoke instead.
      </p>
    </div>
  )
}
