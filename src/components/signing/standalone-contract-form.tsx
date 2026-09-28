"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const TYPES = ["contract", "agreement", "nda", "proposal", "sow", "checklist"] as const

/**
 * Standalone entry for sign-only and track-only use: no analysis, no AI
 * draft, no plan. Creates a draft deal, versions the pasted text as the
 * user's own paper, and — in track mode — records an external signing so
 * the deal lands in the Tracker. Then navigates to the document reader,
 * where signing invitations and monitoring live.
 */
export function StandaloneContractForm({ mode }: { mode: "sign" | "track" }) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [docType, setDocType] = useState<string>("contract")
  const [content, setContent] = useState("")
  const [signedAt, setSignedAt] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    if (!content.trim()) {
      setError("Paste the contract text first.")
      return
    }
    if (mode === "track" && !signedAt) {
      setError("Give the date it was signed.")
      return
    }
    setSaving(true)
    try {
      const { createAudit } = await import("@/app/audit/new/actions")
      const created = await createAudit("generic")
      if (!created.ok) {
        setError(created.error)
        return
      }
      const res = await fetch(`/api/document/${created.auditId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: docType, title: title.trim() || undefined, content }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string; versionId?: string }
      if (!res.ok || !data.success || !data.versionId) {
        setError(data.error ?? "Could not save the document.")
        return
      }
      if (mode === "track") {
        const rec = await fetch(`/api/document/${created.auditId}/versions/${data.versionId}/record-external`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedAt }),
        })
        const recData = (await rec.json()) as { success?: boolean; error?: string }
        if (!rec.ok || !recData.success) {
          setError(recData.error ?? "Saved the document, but could not record the signing.")
          return
        }
      }
      router.push(`/document/${created.auditId}`)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium">
          Contract name
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="MSA with Acme"
            maxLength={120}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
          />
        </label>
        <label className="block text-xs font-medium">
          Type
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-normal" aria-label="Document type">
            {TYPES.map((t) => (
              <option key={t} value={t}>{t === "nda" ? "NDA" : t === "sow" ? "SOW" : t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </label>
      </div>
      {mode === "track" && (
        <label className="block text-xs font-medium">
          Date signed
          <input
            type="date"
            value={signedAt}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setSignedAt(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-normal sm:max-w-[220px]"
          />
        </label>
      )}
      <label className="block text-xs font-medium">
        Contract text
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the full contract text here…"
          rows={6}
          className="mt-1 min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-2 py-2 text-sm font-normal"
        />
      </label>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <Button onClick={() => void handleSubmit()} disabled={saving} size="sm" className="w-full sm:w-auto">
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mode === "sign" ? "Save and continue to signing" : "Save and track it"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        {mode === "sign"
          ? "No analysis, no credits — you will sign first as owner, then send a link to your counterparty."
          : "No analysis, no credits — the signing is recorded as having happened elsewhere, and deadlines can be tracked from the document page."}
      </p>
    </div>
  )
}
