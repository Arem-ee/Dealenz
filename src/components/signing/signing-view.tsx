"use client"

import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Check, Copy, PenLine, Plus, Send, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import {
  addSigner,
  listCeremonies,
  reorderSigner,
  resendSigner,
  revokeSigner,
  setAllowForward,
  signAsOwnerAction,
  startCeremony,
  type Ceremony,
  type MailSummary,
} from "@/app/(app)/signing/actions"
import { listDrafts, type DraftVersionRow } from "@/app/(app)/drafts/actions"
import { SignaturePad } from "@/components/sign/signature-pad"
import type { SignatureMethod } from "@/lib/signatures/validate"

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

function expiryLabel(expiresAt: string | null): { text: string; lapsed: boolean } {
  if (!expiresAt) return { text: "No expiry", lapsed: false }
  const t = new Date(expiresAt).getTime()
  if (Number.isNaN(t)) return { text: "No expiry", lapsed: false }
  if (t <= Date.now()) return { text: `Expired ${formatDate(expiresAt)}`, lapsed: true }
  return { text: `Expires ${formatDate(expiresAt)}`, lapsed: false }
}

// Owner signature panel: adopt a drawn or typed signature, confirm the
// electronic-signature disclosure, then record. The image saves
// artifact-first server-side, so no owner signature lands without one.
function OwnerSignPanel({ signerId, onDone }: { signerId: string; onDone: () => Promise<void> }) {
  const [imageData, setImageData] = useState<string | null>(null)
  const [method, setMethod] = useState<SignatureMethod>("drawn")
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sign() {
    if (busy || !imageData || !consent) return
    setBusy(true)
    setError(null)
    try {
      const res = await signAsOwnerAction({ signerId, consent, imageData, method })
      if (!res.ok) throw new Error(res.error)
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record that signature.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 border border-border p-2.5" aria-label="Owner signature">
      <SignaturePad
        disabled={busy}
        onChange={(data, m) => {
          setImageData(data)
          setMethod(m)
        }}
      />
      <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={busy}
          className="mt-0.5 h-3.5 w-3.5 accent-foreground"
        />
        <span className="text-muted-foreground">
          I agree to sign electronically — my signature carries the same legal effect as a handwritten one.
        </span>
      </label>
      {error && <p role="alert" className="mt-2 border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">{error}</p>}
      <button
        type="button"
        onClick={() => void sign()}
        disabled={busy || !imageData || !consent}
        className="mt-2 inline-flex h-8 items-center bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
      >
        {busy ? "Recording…" : "Sign as owner"}
      </button>
    </div>
  )
}

// Signing: ceremonies with progress, token links, expiry, ordered steps,
// owner drawn/typed signatures, correct-after-send (add/revoke/reorder/
// resend), forwarding control, and the sealed certificate.
export function SigningView() {
  const { showError, showSuccess } = useToast()
  const [ceremonies, setCeremonies] = useState<Ceremony[] | null>(null)
  const [status, setStatus] = useState<StatusFilter>("all")
  const [setupOpen, setSetupOpen] = useState(false)
  const [versions, setVersions] = useState<DraftVersionRow[] | null>(null)
  const [versionId, setVersionId] = useState("")
  const [recipients, setRecipients] = useState<Array<{ name: string; email: string }>>([{ name: "", email: "" }])
  const [message, setMessage] = useState("")
  const [expiryDays, setExpiryDays] = useState("30")
  const [sequential, setSequential] = useState(false)
  const [allowForwardSetup, setAllowForwardSetup] = useState(true)
  const [busy, setBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [ownerPadFor, setOwnerPadFor] = useState<string | null>(null)
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

  function mailNotice(mail: MailSummary) {
    if (mail.emailed.length > 0) {
      showSuccess(`Invited by email: ${mail.emailed.join(", ")}`)
    }
    if (mail.needsCopy.length > 0) {
      showError(
        mail.gmailConnected
          ? `Email failed for ${mail.needsCopy.join(", ")} — copy the links below.`
          : `Gmail isn't connected — copy the links below to invite ${mail.needsCopy.join(", ")}.`
      )
    }
  }

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
        expiresInDays: expiryDays.trim() === "" ? undefined : Number(expiryDays),
        sequential,
        allowForward: allowForwardSetup,
      })
      if (!res.ok) throw new Error(res.error)
      mailNotice(res.mail)
      setSetupOpen(false)
      setRecipients([{ name: "", email: "" }])
      setMessage("")
      setExpiryDays("30")
      setSequential(false)
      setAllowForwardSetup(true)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start signing.")
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
      mailNotice(res.mail)
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

  async function resend(signerId: string) {
    if (rowBusy) return
    setRowBusy(signerId)
    try {
      const res = await resendSigner({ signerId })
      if (!res.ok) throw new Error(res.error)
      if (res.mailed) showSuccess("Invitation re-sent by email.")
      else showError(res.reason === "gmail_not_connected" ? "Gmail isn't connected — copy the link instead." : (res.reason ?? "Email failed — copy the link instead."))
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't re-send that invitation.")
    } finally {
      setRowBusy(null)
    }
  }

  async function reorder(signerId: string, direction: "earlier" | "later") {
    if (rowBusy) return
    setRowBusy(signerId)
    try {
      const res = await reorderSigner({ signerId, direction })
      if (!res.ok) throw new Error(res.error)
      setCeremonies((prev) => prev?.map((c) => (c.signers.some((s) => s.id === signerId) ? res.ceremony : c)) ?? null)
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't reorder that step.")
    } finally {
      setRowBusy(null)
    }
  }

  async function flipForward(versionIdValue: string, allow: boolean) {
    if (rowBusy) return
    setRowBusy(versionIdValue)
    try {
      const res = await setAllowForward({ versionId: versionIdValue, allow })
      if (!res.ok) throw new Error(res.error)
      setCeremonies((prev) => prev?.map((c) => (c.versionId === versionIdValue ? res.ceremony : c)) ?? null)
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't change forwarding.")
    } finally {
      setRowBusy(null)
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

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground" htmlFor="ceremony-expiry">
                Links expire after
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  id="ceremony-expiry"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                  disabled={busy}
                  inputMode="numeric"
                  aria-label="Link expiry in days"
                  className="h-9 w-16 border border-input bg-background px-2 text-sm outline-none disabled:opacity-60"
                />
                <span className="text-xs text-muted-foreground">days (1–120)</span>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={sequential}
                onChange={(e) => setSequential(e.target.checked)}
                disabled={busy}
                className="h-3.5 w-3.5 accent-foreground"
              />
              <span className="text-muted-foreground">Sign in order <span className="text-muted-foreground/70">(off = all at once)</span></span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={allowForwardSetup}
                onChange={(e) => setAllowForwardSetup(e.target.checked)}
                disabled={busy}
                className="h-3.5 w-3.5 accent-foreground"
              />
              <span className="text-muted-foreground">Invitees may forward to a colleague</span>
            </label>
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
                    {c.signers.map((s) => {
                      const expiry = expiryLabel(s.expiresAt)
                      return (
                        <li key={s.id} className="text-[13px]">
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate">
                              {s.isOwner ? null : <span className="mr-1 inline-block w-10 shrink-0 text-[11px] tabular-nums text-muted-foreground">Step {s.signOrder}</span>}
                              {s.name} <span className="text-muted-foreground">· {s.isOwner ? "owner" : s.email} · {s.status}</span>
                              {s.signedAt && <span className="text-muted-foreground"> · {formatDate(s.signedAt)}</span>}
                              {s.status === "signed" && s.hasSignatureImage && <span className="text-muted-foreground"> · signature on file</span>}
                            </span>
                            {(s.status === "pending" || s.status === "expired") && (
                              <span className={cn("shrink-0 text-[11px] tabular-nums", expiry.lapsed || s.status === "expired" ? "font-semibold text-destructive" : "text-muted-foreground")}>
                                {s.status === "expired" ? `Expired ${formatDate(s.expiresAt)}` : expiry.text}
                              </span>
                            )}
                            {s.status === "pending" && s.waitingOnEarlier && (
                              <span className="shrink-0 text-[11px] text-muted-foreground" title="Earlier steps sign first">waiting</span>
                            )}
                            {s.status === "pending" && s.link && !s.isOwner && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void reorder(s.id, "earlier")}
                                  disabled={rowBusy !== null}
                                  aria-label={`Move ${s.name} earlier`}
                                  className="shrink-0 p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void reorder(s.id, "later")}
                                  disabled={rowBusy !== null}
                                  aria-label={`Move ${s.name} later`}
                                  className="shrink-0 p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void resend(s.id)}
                                  disabled={rowBusy !== null}
                                  aria-label={`Re-send invitation to ${s.name}`}
                                  title="Re-send invitation email"
                                  className="shrink-0 p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                            {(s.status === "pending" || s.status === "expired") && s.link && !s.isOwner && (
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
                            {s.status === "pending" && s.isOwner && ownerPadFor !== s.id && (
                              <button
                                type="button"
                                onClick={() => setOwnerPadFor(s.id)}
                                disabled={busy}
                                className="shrink-0 bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
                              >
                                Sign
                              </button>
                            )}
                            {(s.status === "pending" || s.status === "expired") && !s.isOwner && (
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
                          </div>
                          {s.status === "pending" && s.isOwner && ownerPadFor === s.id && (
                            <OwnerSignPanel signerId={s.id} onDone={async () => { setOwnerPadFor(null); await refresh() }} />
                          )}
                        </li>
                      )
                    })}
                  </ul>

                  {!["locked", "fully_signed", "superseded"].includes(c.status) && (
                    <div className="mt-3 border-t border-border pt-2.5">
                      <label className="flex cursor-pointer items-center gap-2 text-[11px]">
                        <input
                          type="checkbox"
                          checked={c.allowForward}
                          onChange={(e) => void flipForward(c.versionId, e.target.checked)}
                          disabled={rowBusy !== null}
                          className="h-3.5 w-3.5 accent-foreground"
                        />
                        <span className="text-muted-foreground">Invitees may forward to a colleague</span>
                      </label>
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
        Invitations email from your connected Gmail when available — otherwise copy the link. Every link carries its expiry; re-send or revoke lapsed invitations.
      </p>
    </div>
  )
}
