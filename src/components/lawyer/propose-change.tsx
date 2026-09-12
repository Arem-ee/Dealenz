"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { proposeChange } from "@/app/lawyer/actions"

// Lawyer document proposal: revised content becomes a NEW document version
// (history append-only, prior versions intact); the linked note records the
// rationale. The client accepts or declines from their workspace; nothing is
// overwritten and no version is ever marked final by the lawyer alone.
export function ProposeChange({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [documentType, setDocumentType] = useState("")
  const [revisedContent, setRevisedContent] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function handlePropose() {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const res = await proposeChange(requestId, { documentType, revisedContent, note })
      setDone(`Proposed as version ${res.versionNumber}. The client will review it.`)
      setDocumentType("")
      setRevisedContent("")
      setNote("")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Proposal failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
      <h3 className="text-sm font-semibold">Propose document change</h3>
      <p className="text-xs text-muted-foreground">
        Paste the full revised document text. It is stored as a new version — the previous version stays intact and the client decides.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="prop-doctype">Document type</Label>
        <Input id="prop-doctype" value={documentType} onChange={(e) => setDocumentType(e.target.value)} placeholder="e.g. contract" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prop-note">Rationale for the client</Label>
        <Textarea id="prop-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Why this change matters…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prop-content">Revised document text</Label>
        <Textarea id="prop-content" value={revisedContent} onChange={(e) => setRevisedContent(e.target.value)} rows={8} placeholder="Full revised text…" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {done && <p className="text-xs text-success">{done}</p>}
      <Button size="sm" disabled={busy || !documentType.trim() || !revisedContent.trim() || !note.trim()} onClick={() => void handlePropose()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Propose revision
      </Button>
    </div>
  )
}
