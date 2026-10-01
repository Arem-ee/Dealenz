"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { resolveMonitoringEventAction } from "@/lib/monitoring/actions"

export function EventStatusButtons({ auditId, eventId, status }: { auditId: string; eventId: string; status: "active" | "completed" | "dismissed" }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function setStatus(next: "active" | "completed" | "dismissed") {
    if (busy) return
    setBusy(next)
    setError(null)
    try {
      const res = await resolveMonitoringEventAction(auditId, eventId, next)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    } catch {
      setError("Could not update that obligation. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  if (status !== "active") {
    return (
      <span className="inline-flex shrink-0 flex-col items-end gap-0.5">
        <button
          type="button"
          onClick={() => void setStatus("active")}
          disabled={busy !== null}
          className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-muted/60 disabled:opacity-50"
        >
          {busy ? "Working…" : "Reopen"}
        </button>
        {error && <span role="alert" className="max-w-[140px] text-right text-[10px] text-destructive">{error}</span>}
      </span>
    )
  }

  return (
    <span className="inline-flex shrink-0 flex-col items-end gap-1">
      <span className="flex gap-1">
        <button
          type="button"
          onClick={() => void setStatus("completed")}
          disabled={busy !== null}
          aria-label="Mark obligation done"
          className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/60 disabled:opacity-50"
        >
          {busy === "completed" ? "Working…" : "Done"}
        </button>
        <button
          type="button"
          onClick={() => void setStatus("dismissed")}
          disabled={busy !== null}
          aria-label="Dismiss obligation"
          className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/60 disabled:opacity-50"
        >
          {busy === "dismissed" ? "Working…" : "Dismiss"}
        </button>
      </span>
      {error && <span role="alert" className="max-w-[140px] text-right text-[10px] text-destructive">{error}</span>}
    </span>
  )
}
