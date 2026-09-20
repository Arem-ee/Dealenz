"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileText, ArrowLeft, Check, Clock, History, Send, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import { renderMarkdown } from "@/lib/markdown"
import { ClientTime } from "@/components/datetime"

interface VersionItem {
  id: string
  documentType: string
  versionNumber: number
  content: string
  createdAt: string
  generationMethod?: string | null
}

interface Signer {
  id: string
  name: string
  email: string
  partyLabel: string
  status: string
  signedAt: string | null
  token?: string | null
}

export function DocumentReader({
  auditId,
  threadId,
  versions,
  signers,
  executed,
  isFinal,
  guarded,
}: {
  auditId: string
  threadId?: string | null
  versions: VersionItem[]
  signers: Signer[]
  executed: boolean
  isFinal: boolean
  guarded?: { created: number; total: number } | null
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string>(versions[0]?.id ?? "")
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0]
  const [counterpartyName, setCounterpartyName] = useState("")
  const [counterpartyEmail, setCounterpartyEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [sideOpen, setSideOpen] = useState(false)
  const { showError, showSuccess } = useToast()

  function fail(message: string) {
    // Real server message in a toast; success notices stay inline next to the action.
    showError(message)
  }

  const ownerSigner = signers.find((s) => s.partyLabel === "owner" || s.partyLabel === "Owner")
  const counterpartySigner = signers.find((s) => s.partyLabel !== "owner" && s.partyLabel !== "Owner")

  async function handleAddCounterparty() {
    if (!counterpartyName.trim() || !counterpartyEmail.trim()) {
      fail("Enter name and email for counterparty")
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/document/${auditId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: counterpartyName.trim(), email: counterpartyEmail.trim(), partyLabel: "counterparty", documentVersionId: selected?.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? "Failed to add counterparty")
      setNotice("Counterparty added. They will be notified when you send for signature.")
      showSuccess("Counterparty added. They will be notified when you send for signature.", "Counterparty added")
      router.refresh()
    } catch (e) {
      fail(e instanceof Error ? e.message : "Failed to add counterparty")
    } finally {
      setBusy(false)
    }
  }

  async function handleSend() {
    setBusy(true)
    try {
      const res = await fetch(`/api/document/${auditId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentVersionId: selected?.id }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? "Failed to send")
      setNotice("Sent for signature — counterparty notified.")
      showSuccess("Sent for signature. The counterparty can now sign their link.", "Sent")
      router.refresh()
    } catch (e) {
      fail(e instanceof Error ? e.message : "Failed to send")
    } finally {
      setBusy(false)
    }
  }

  async function handleOwnerSign() {
    if (!ownerSigner) return
    setBusy(true)
    try {
      const res = await fetch(`/api/document/${auditId}/sign-owner`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signerId: ownerSigner.id }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? "Signing failed")
      setNotice("You signed. Counterparty has been notified.")
      showSuccess("You signed. The counterparty can now sign.", "Signed")
      router.refresh()
    } catch (e) {
      fail(e instanceof Error ? e.message : "Signing failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          {threadId ? (
            <Link href={`/chat/${threadId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to thread
            </Link>
          ) : (
            <Link href="/chat" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to deals
            </Link>
          )}
          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> {selected?.documentType ?? "document"} v{selected?.versionNumber ?? "-"}
            {executed && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success"><Check className="h-3 w-3" /> Executed</span>}
            {!executed && isFinal && <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700">Final — pending signatures</span>}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-6 prose prose-sm max-w-none font-serif">
            {selected ? renderMarkdown(selected.content) : <p className="text-sm text-muted-foreground">No document versions yet. Generate a draft in chat first.</p>}
          </div>
          {executed && (
            <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-xs text-success flex items-center gap-2">
              <Check className="h-4 w-4" /> This document is fully executed and immutable. Any further changes require a new draft/version.
            </div>
          )}
          {executed && guarded && guarded.created > 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-xs leading-relaxed">
              <p className="font-medium">Now guarded: {guarded.created} deadline{guarded.created === 1 ? "" : "s"} from the signed text {guarded.created === 1 ? "is" : "are"} tracked in monitoring.</p>
              <p className="mt-1 text-muted-foreground">
                Add email alerts before they matter in{" "}
                {threadId ? (
                  <Link href={`/chat/${threadId}`} className="font-medium text-primary hover:underline">
                    the deal thread
                  </Link>
                ) : (
                  <Link href="/dashboard" className="font-medium text-primary hover:underline">
                    your dashboard
                  </Link>
                )}
                .
              </p>
            </div>
          )}
          {executed && guarded && guarded.created === 0 && guarded.total === 0 && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              <p>No dated obligations were found in the signed text. Track renewals and deadlines yourself in{" "}
                {threadId ? (
                  <Link href={`/chat/${threadId}`} className="font-medium text-primary hover:underline">
                    monitoring in the deal thread
                  </Link>
                ) : (
                  <Link href="/dashboard" className="font-medium text-primary hover:underline">
                    monitoring on your dashboard
                  </Link>
                )}
                .
              </p>
            </div>
          )}
        </div>

        {/* Thin sidebar on desktop; collapsible section on mobile. */}
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setSideOpen((v) => !v)}
            aria-expanded={sideOpen}
            className="flex w-full items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm font-medium"
          >
            Details and signing
            <span className="text-xs text-muted-foreground">{sideOpen ? "Hide" : "Show"}</span>
          </button>
        </div>
        <div className={`space-y-4 ${sideOpen ? "block" : "hidden"} lg:block`}>
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><History className="h-4 w-4" /> Versions</h3>
            <div className="mt-3 space-y-1">
              {versions.length === 0 && <p className="text-xs text-muted-foreground">No versions — generate a draft in chat first.</p>}
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className={`w-full text-left rounded-md px-2.5 py-2 text-xs border ${selectedId === v.id ? "bg-primary/10 border-primary/20" : "bg-muted/30 hover:bg-muted"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{v.documentType} v{v.versionNumber}</span>
                    <span className="text-[10px] text-muted-foreground"><ClientTime iso={v.createdAt} kind="day" /></span>
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize">{v.generationMethod ?? "draft"}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">Signers</h3>
            <div className="mt-3 space-y-2">
              {signers.length === 0 && <p className="text-xs text-muted-foreground">No signers yet. Add a counterparty below.</p>}
              {signers.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div>
                    <p className="text-xs font-medium">{s.name} <span className="text-muted-foreground font-normal">({s.partyLabel})</span></p>
                    <p className="text-[11px] text-muted-foreground">{s.email}</p>
                  </div>
                  <span className={`text-[10px] rounded-full px-2 py-1 font-medium capitalize ${s.status === "signed" ? "bg-success/10 text-success" : s.status === "pending" ? "bg-amber-500/10 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                    {s.status === "signed" ? <><Check className="h-3 w-3 inline mr-1" />signed</> : s.status}
                  </span>
                </div>
              ))}
            </div>

            {!executed && (
              <>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="cp-name" className="text-xs">Counterparty</Label>
                  <Input id="cp-name" placeholder="Name" value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} className="h-8 text-xs" />
                  <Input placeholder="Email" value={counterpartyEmail} onChange={(e) => setCounterpartyEmail(e.target.value)} className="h-8 text-xs" />
                  <Button size="sm" variant="outline" className="w-full" onClick={() => void handleAddCounterparty()} disabled={busy}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add counterparty
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  {ownerSigner && ownerSigner.status === "pending" && (
                    <Button size="sm" className="w-full" onClick={() => void handleOwnerSign()} disabled={busy}>
                      {busy ? "Signing…" : "Sign as owner (first)"}
                    </Button>
                  )}
                  {ownerSigner?.status === "signed" && counterpartySigner?.status === "pending" && (
                    <Button size="sm" className="w-full" onClick={() => void handleSend()} disabled={busy}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Send to counterparty
                    </Button>
                  )}
                  {ownerSigner?.status === "signed" && !counterpartySigner && (
                    <p className="text-[11px] text-muted-foreground">You have signed. Add a counterparty above to send it for signature.</p>
                  )}
                  {!ownerSigner && signers.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Add a counterparty, then sign as owner first — then it will be sent to the counterparty.</p>
                  )}
                </div>
              </>
            )}

            {notice && <div className="mt-3 rounded-md bg-success/10 p-2 text-xs text-success">{notice}</div>}
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h4 className="text-xs font-semibold">Notifications</h4>
            <p className="mt-1 text-xs text-muted-foreground">Both parties are notified on send and on each signature. When fully executed, the final version is locked.</p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {executed ? "Completed" : signers.length > 0 && signers.every((s) => s.status === "signed") ? "Signatures complete — locking" : signers.some((s) => s.status === "pending") ? "Pending signatures" : "Not sent"}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
