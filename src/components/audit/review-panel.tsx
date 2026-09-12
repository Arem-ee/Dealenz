"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  getReviewState,
  addOwnerComment,
  resolveProposal,
  cancelReview,
  inviteSigner,
  revokeSigner,
  createServiceOrder,
} from "@/app/audit/[id]/review-actions"

interface PanelComment {
  id: string
  author_role: string
  target_type: string
  target_key: string | null
  body: string
  status: string
  provenance: string
  created_at: string
}

interface PanelSigner {
  id: string
  name: string
  email: string
  party_label: string
  document_type: string
  status: string
  signed_at: string | null
}

interface PanelOrder {
  id: string
  amount_minor: number | null
  currency: string | null
  status: string
}

interface PanelFinal {
  document_type: string
  document_version_id: string
  finalized_at: string
}

interface PanelState {
  request: { id: string; status: string; lawyer_id: string | null } | null
  lawyer: { full_name: string; verification_status: string } | null
  comments: PanelComment[]
  signers: PanelSigner[]
  serviceOrders: PanelOrder[]
  versions: Array<{ id: string; document_type: string; version_number: number }>
  finals: PanelFinal[]
}

// Deal-scoped collaboration surface for the deal owner. Renders nothing
// until a review, signer, or service order exists for this deal. Lawyer
// contributions render with lawyer provenance; accepting a proposal resolves
// the note — history (versions, comments) is never rewritten.
export function ReviewPanel({ auditId }: { auditId: string }) {
  const [state, setState] = useState<PanelState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState("")
  const [signerName, setSignerName] = useState("")
  const [signerEmail, setSignerEmail] = useState("")
  const [signerRole, setSignerRole] = useState("signer")
  const [signerVersionId, setSignerVersionId] = useState("")

  async function load() {
    try {
      const res = await getReviewState(auditId)
      return {
        request: res.request as PanelState["request"],
        lawyer: res.lawyer as PanelState["lawyer"],
        comments: res.comments as PanelComment[],
        signers: res.signers as PanelSigner[],
        serviceOrders: res.serviceOrders as PanelOrder[],
        versions: (res.versions ?? []) as PanelState["versions"],
        finals: (res.finals ?? []) as PanelFinal[],
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load collaboration")
      return null
    }
  }

  async function refresh() {
    const next = await load()
    if (next) setState(next)
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next = await load()
      if (cancelled) return
      if (next) setState(next)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading collaboration…
      </div>
    )
  }
  if (error || !state) {
    return <p className="text-xs text-muted-foreground">Collaboration unavailable right now.</p>
  }
  const hasAnything =
    state.request !== null || state.signers.length > 0 || state.serviceOrders.length > 0 || state.finals.length > 0
  if (!hasAnything) return null

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label)
    setError(null)
    try {
      await fn()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  const proposals = state.comments.filter(
    (c) => c.author_role === "lawyer" && c.target_type === "document" && c.status === "open"
  )
  const signedCount = state.signers.filter((s) => s.status === "signed").length

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
      <h3 className="text-sm font-semibold">Review &amp; collaboration</h3>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {state.request && (
        <div className="text-xs">
          <p>
            <span className="font-medium">Lawyer review:</span> {state.request.status}
            {state.lawyer ? ` · ${state.lawyer.full_name} (${state.lawyer.verification_status})` : ""}
          </p>
          {!["completed", "cancelled"].includes(state.request.status) && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={busy !== null}
              onClick={() => void run("cancel", () => cancelReview(state.request!.id))}
            >
              Cancel review (revokes lawyer access)
            </Button>
          )}
        </div>
      )}

      {proposals.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold">Lawyer proposals awaiting your decision</h4>
          {proposals.map((p) => (
            <div key={p.id} className="rounded-lg border border-warning/25 bg-warning/[0.06] p-3">
              <p className="text-[11px] font-medium text-foreground">
                Proposed change{p.target_key ? ` · ${p.target_key}` : ""}
              </p>
              <p className="mt-1 text-xs whitespace-pre-wrap">{p.body}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" disabled={busy !== null} onClick={() => void run(`accept-${p.id}`, () => resolveProposal(p.id, "accept"))}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run(`decline-${p.id}`, () => resolveProposal(p.id, "decline"))}>
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-semibold">Discussion</h4>
        {state.comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
        <ul className="space-y-2">
          {state.comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-border/60 p-3">
              <p className="text-[11px] text-muted-foreground">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.provenance === "lawyer" ? "bg-info/10 text-info" : "bg-muted text-muted-foreground"}`}>
                  {c.provenance === "lawyer" ? "Lawyer review" : "You"}
                </span>{" "}
                {c.target_type}{c.target_key ? ` · ${c.target_key}` : ""} · {c.status}
              </p>
              <p className="mt-1 text-xs whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
        {state.request && (
          <div className="space-y-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to your lawyer…" rows={2} />
            <Button
              size="sm"
              disabled={busy !== null || !reply.trim()}
              onClick={() =>
                void run("reply", async () => {
                  await addOwnerComment(state.request!.id, { targetType: "question", body: reply.trim() })
                  setReply("")
                })
              }
            >
              {busy === "reply" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send reply
            </Button>
          </div>
        )}
      </div>

      {state.finals.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold">Final documents</h4>
          {state.finals.map((f) => (
            <p key={`${f.document_type}`} className="text-xs">
              {f.document_type} · finalized {new Date(f.finalized_at).toLocaleDateString()}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-semibold">
          Signers ({signedCount}/{state.signers.length} signed)
          {state.signers.length > 0 && signedCount === state.signers.length ? " · fully executed" : ""}
        </h4>
        {state.signers.length === 0 && <p className="text-xs text-muted-foreground">No signers invited yet.</p>}
        <ul className="space-y-1">
          {state.signers.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
              <span>{s.name} ({s.party_label}) — <span className="font-medium">{s.status}</span></span>
              {s.status === "pending" && (
                <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`revoke-${s.id}`, () => revokeSigner(s.id))}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
        {state.versions.length > 0 && (
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <p className="text-xs font-medium">Invite a signer (binds the latest version)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="inv-name">Full name</Label>
                <Input id="inv-name" value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Party name" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inv-email">Email</Label>
                <Input id="inv-email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="party@example.com" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inv-role">Party / role</Label>
                <Input id="inv-role" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} placeholder="e.g. buyer, witness" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inv-version">Document version</Label>
                <select
                  id="inv-version"
                  value={signerVersionId}
                  onChange={(e) => setSignerVersionId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select version…</option>
                  {state.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.document_type} v{v.version_number}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              size="sm"
              disabled={busy !== null || !signerName.trim() || !signerEmail.trim() || !signerVersionId}
              onClick={() =>
                void run("invite", async () => {
                  await inviteSigner(auditId, {
                    documentVersionId: signerVersionId,
                    name: signerName.trim(),
                    email: signerEmail.trim(),
                    partyLabel: signerRole.trim() || "signer",
                  })
                  setSignerName("")
                  setSignerEmail("")
                })
              }
            >
              {busy === "invite" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Invite signer
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold">Service orders (money, separate from credits)</h4>
        {state.serviceOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No service orders. Requesting paid legal work creates a service order here — never a credit charge. Payment processing is a separate next step.
          </p>
        ) : (
          <ul className="space-y-1">
            {state.serviceOrders.map((o) => (
              <li key={o.id} className="text-xs">
                Order {o.id.slice(0, 8)}… · {o.status}
                {o.amount_minor != null ? ` · ${o.amount_minor} ${o.currency ?? ""}` : " · amount to be quoted"}
              </li>
            ))}
          </ul>
        )}
        {state.request && !["cancelled"].includes(state.request.status) && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void run("order", () => createServiceOrder(auditId, state.request!.id, {}))}
          >
            Request paid legal work (service order)
          </Button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Lawyer contributions are professional opinions attached to this deal — they never alter Dealenz findings, rules, or sources.
      </p>
    </div>
  )
}
