"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { restoreVersionAsDraft } from "@/app/drafts/actions"

export function RestoreButton({ auditId, versionId, versionNumber }: { auditId: string; versionId: string; versionNumber: number }) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function restore() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await restoreVersionAsDraft(auditId, versionId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    } catch {
      setError("Could not restore that version. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => { setArmed(true); setError(null) }}
        aria-label={`Restore version ${versionNumber} as a new draft`}
        className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        Restore
      </button>
    )
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5">
      <span className="flex gap-1">
        <button
          type="button"
          onClick={() => void restore()}
          disabled={busy}
          className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Working…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          disabled={busy}
          aria-label="Cancel restore"
          className="rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Keep
        </button>
      </span>
      {error && <span role="alert" className="max-w-[160px] text-right text-[10px] text-destructive">{error}</span>}
    </span>
  )
}
