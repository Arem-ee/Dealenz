"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Copy, Link2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createShareToken, getShareStatus, revokeShareToken } from "@/app/audit/[id]/actions"

// Publish this deal's risk findings behind a revocable tokenized link.
// The share dialog states exactly what the link exposes before creating it:
// severity, summary, guidance, counter-words, and quoted evidence —
// nothing else leaves the account. Links live 30 days and revoke here.
export function ShareReportButton({ auditId }: { auditId: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [tokenId, setTokenId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function loadExisting(): Promise<boolean> {
    const res = await getShareStatus(auditId)
    if (!res.success || !res.tokens) return false
    const live = res.tokens.find((t) => t.document_type === "report" && !t.revoked_at)
    if (!live) return false
    const appUrl = typeof window !== "undefined" ? window.location.origin : ""
    setLink(`${appUrl}/report/${live.token}`)
    setTokenId(live.id)
    return true
  }

  async function handleOpen() {
    setOpen(true)
    setError(null)
    if (link) return
    setBusy(true)
    try {
      if (!(await loadExisting())) {
        setLink(null)
        setTokenId(null)
      }
    } catch {
      // Listing failures must not block creating a fresh link.
    } finally {
      setBusy(false)
    }
  }

  async function handleCreate() {
    setBusy(true)
    setError(null)
    try {
      const res = await createShareToken(auditId, "report")
      if (!res.success || !res.shareUrl) throw new Error(res.error ?? "Could not create the link.")
      setLink(res.shareUrl)
      await loadExisting().catch(() => null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the link. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Could not copy the link — select it manually.")
    }
  }

  async function handleRevoke() {
    if (!tokenId) return
    setBusy(true)
    setError(null)
    try {
      const res = await revokeShareToken(tokenId)
      if (!res.success) throw new Error(res.error ?? "Could not revoke the link.")
      setLink(null)
      setTokenId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke the link. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => void handleOpen()}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Link2 className="h-3.5 w-3.5" />
        Share report
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 p-3">
      <p className="text-xs font-medium">Share this risk report</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Anyone with the link sees severity, summary, guidance, counter-words, and quoted evidence for 30 days. Nothing else leaves your account.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {!link ? (
        <Button size="sm" className="mt-2" disabled={busy} onClick={() => void handleCreate()}>
          {busy ? "Working…" : "Create public link"}
        </Button>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              aria-label="Public report link"
              onFocus={(e) => e.target.select()}
              className="h-8 flex-1 truncate rounded-md border border-input bg-card px-2 text-xs"
            />
            <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
              {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRevoke()}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              Revoke link
            </button>
            <Link href={link} target="_blank" rel="noopener" className="text-[11px] font-medium text-primary hover:underline">
              Preview
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
