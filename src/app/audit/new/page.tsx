"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import { createAudit } from "./actions"
import { DealTypeSelector, type DealType } from "@/components/audit/deal-type-selector"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, X } from "lucide-react"
import { clearPendingFile, getPendingFile } from "@/lib/pending-file"

function NewAuditContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const template = searchParams.get("template") || undefined
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

  async function handleContinue() {
    if (!dealType) return
    setCreating(true)
    setError(null)
    try {
      await createAudit(template, dealType)
    } catch (err) {
      if (isRedirectError(err)) return
      setError(err instanceof Error ? err.message : "Failed to create audit")
      setCreating(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push("/dashboard")}>Cancel</Button>
            <Link href="/templates" className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">
              New from template
            </Link>
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
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        </div>
      }
    >
      <NewAuditContent />
    </Suspense>
  )
}
