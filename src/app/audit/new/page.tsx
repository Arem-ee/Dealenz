"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createAudit } from "./actions"
import { DealTypeSelector, type DealType } from "@/components/audit/deal-type-selector"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, X } from "lucide-react"
import { clearPendingFile, getPendingFile } from "@/lib/pending-file"

function NewAuditContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialType = searchParams.get("deal_type") as DealType | null
  const hasFileParam = searchParams.get("hasFile") === "1"
  const [dealType, setDealType] = useState<DealType | null>(initialType ?? null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Module-variable read (no DOM/storage), safe as a lazy initializer, so no
  // effect is needed to pick up the staged file.
  const [pendingFileName, setPendingFileName] = useState<string | null>(() => {
    const f = hasFileParam ? getPendingFile() : null
    return f ? `${f.name} — ${(f.size / 1024).toFixed(0)} KB` : null
  })
  const [attachError, setAttachError] = useState<string | null>(null)
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null)

  async function handleContinue() {
    if (!dealType) return
    setCreating(true)
    setError(null)
    setAttachError(null)
    try {
      const created = await createAudit(dealType)
      const staged = hasFileParam ? getPendingFile() : null
      if (staged) {
        // The staged file's bytes finally land: upload + credit-gated
        // attach against the new audit before entering the thread.
        const { uploadAndAttachFile } = await import("@/lib/files/attach")
        const attached = await uploadAndAttachFile(created.auditId, staged)
        clearPendingFile()
        setPendingFileName(null)
        if (!attached.ok) {
          // Deal and thread exist; hold navigation so the reason is seen.
          // The user can buy credits or continue and paste the text instead.
          setCreatedThreadId(created.threadId)
          setAttachError(attached.error)
          setCreating(false)
          return
        }
      }
      router.push(`/chat/${created.threadId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create audit")
      setCreating(false)
    }
  }

  return (
    <div className="flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-6">
        {pendingFileName && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
            <FileText className="h-4 w-4 text-primary" />
            <span className="flex-1 truncate">{pendingFileName}</span>
            <span className="text-xs text-muted-foreground">ready to upload</span>
            <button
              type="button"
              onClick={() => {
                clearPendingFile()
                setPendingFileName(null)
              }}
              className="ml-2 rounded p-1 hover:bg-muted"
              aria-label="Remove pending file"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <DealTypeSelector value={dealType} onChange={setDealType} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {attachError && createdThreadId && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-relaxed text-red-800">
            <p>{attachError}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => router.push("/billing")}>
                Buy credits
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push(`/chat/${createdThreadId}`)}>
                Continue to thread and paste the text
              </Button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push("/dashboard")}>Cancel</Button>
          </div>
          <Button onClick={handleContinue} disabled={!dealType || creating}>
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function NewAuditPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center px-4 py-10" role="status" aria-label="Loading">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
        </div>
      }
    >
      <NewAuditContent />
    </Suspense>
  )
}
