"use client"

import { useEffect, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { VersionPdfExport } from "@/components/audit/pdf-export"
import {
  getFinalDocuments,
  finalizeDocument,
  completeDeal,
  type FinalDocumentView,
  type VersionListItem,
} from "@/app/audit/[id]/document-actions"

// Final/executed document surface for the deal owner. Finals are explicit
// server pointers (never "newest wins"); execution derives from bound
// signer state; completion requires finals plus finished signing. Drafts,
// term sheets, and agreements keep their honest labels throughout.
export function FinalDocumentsPanel({ auditId, auditStatus }: { auditId: string; auditStatus: string }) {
  const [finals, setFinals] = useState<FinalDocumentView[]>([])
  const [versions, setVersions] = useState<VersionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(auditStatus === "completed")

  async function refresh() {
    try {
      const res = await getFinalDocuments(auditId)
      setFinals(res.finals)
      setVersions(res.versions)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load final documents")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await getFinalDocuments(auditId)
        if (cancelled) return
        setFinals(res.finals)
        setVersions(res.versions)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load final documents")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId])

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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading final documents…
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
      <h3 className="text-sm font-semibold">Final &amp; executed documents</h3>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {finals.length === 0 && versions.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No document versions yet. Generate a draft above — finalization names the exact version intended for execution.
        </p>
      )}
      {versions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold">Versions (finalize the exact version to execute)</h4>
          <ul className="space-y-1">
            {versions.slice(0, 10).map((v) => {
              const isFinal = finals.some((f) => f.documentVersionId === v.id)
              return (
                <li key={v.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    {v.documentType} v{v.versionNumber}
                    {isFinal && <span className="ml-2 font-medium text-success">· final</span>}
                  </span>
                  {!isFinal && (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run(`finalize-${v.id}`, () => finalizeDocument(auditId, v.id))}>
                      Finalize
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {finals.map((f) => (
        <div key={f.id} className="rounded-lg border border-border/60 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {f.title} <span className="text-xs font-normal text-muted-foreground">v{f.versionNumber}</span>
            </p>
            <StatusBadge tone={f.executed ? "burgundy" : "warning"}>
              {f.executed ? "Executed" : "Final — awaiting signatures"}
            </StatusBadge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Finalized {new Date(f.finalizedAt).toLocaleDateString()} · {f.signers.length} signer{f.signers.length === 1 ? "" : "s"}
            {f.signers.length > 0 && ` (${f.signers.filter((s) => s.status === "signed").length} signed)`}
          </p>
          <VersionPdfExport
            title={f.title}
            subtitle={`${f.documentType} · version ${f.versionNumber}${f.executed ? " · executed" : " · final (unsigned)"}`}
            content={f.content}
            fileName={`dealenz-${f.documentType}-v${f.versionNumber}${f.executed ? "-executed" : ""}.pdf`}
            signatures={f.signers.map((s) => ({ name: s.name, partyLabel: s.partyLabel, status: s.status, signedAt: s.signedAt }))}
            executed={f.executed}
            label={f.executed ? "Download executed PDF" : "Download final PDF"}
          />
        </div>
      ))}
      {!completed ? (
        <Button
          size="sm"
          disabled={busy !== null || finals.length === 0}
          onClick={() =>
            void run("complete", async () => {
              const res = await completeDeal(auditId)
              if (res.status === "completed") setCompleted(true)
            })
          }
        >
          {busy === "complete" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          Complete deal
        </Button>
      ) : (
        <p className="text-xs font-medium text-success">Deal completed. New versions can still be drafted, but the executed finals above are locked.</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Executed means every required signer signed this exact version. Downloads reflect the stored version plus its signature record — never a re-rendered substitute.
      </p>
    </div>
  )
}
