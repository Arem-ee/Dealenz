"use client"

import { useState } from "react"

export function ResendButton({ auditId, name, email }: { auditId: string; name: string; email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle")
  const [error, setError] = useState<string | null>(null)

  async function resend() {
    if (state === "sending" || state === "sent") return
    setState("sending")
    setError(null)
    try {
      const res = await fetch(`/api/document/${auditId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        setState("failed")
        setError(data.error ?? "Could not resend. Open the deal to retry.")
        return
      }
      setState("sent")
    } catch {
      setState("failed")
      setError("Could not resend. Open the deal to retry.")
    }
  }

  if (state === "sent") {
    return <span className="shrink-0 px-2 text-xs font-medium text-emerald-700">Resent</span>
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5 px-1">
      <button
        type="button"
        onClick={() => void resend()}
        disabled={state === "sending"}
        aria-label={`Resend invite to ${name}`}
        className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-muted/60 disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : state === "failed" ? "Retry" : "Resend"}
      </button>
      {state === "failed" && error && (
        <span role="alert" className="max-w-[140px] text-right text-[10px] text-destructive">
          {error}
        </span>
      )}
    </span>
  )
}
