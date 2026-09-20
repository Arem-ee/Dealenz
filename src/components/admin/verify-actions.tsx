"use client"

import { useState } from "react"

// Admin verify/reject/suspend/reinstate with visible failure states.
// Previously a failed request silently did nothing, leaving the admin
// unsure whether the action landed.
export function LawyerVerifyActions({ lawyerId, lawyerName, status }: { lawyerId: string; lawyerName: string; status: string }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: "verify" | "reject" | "suspend" | "reinstate") {
    if (busy) return
    if (action === "suspend" && !window.confirm(`Pause ${lawyerName}'s verification? They immediately lose professional access until reinstated.`)) return
    setBusy(action)
    setError(null)
    try {
      const res = await fetch("/api/admin/lawyers/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawyer_id: lawyerId, action }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed. Please try again.")
      setBusy(null)
    }
  }

  const btn = "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center justify-end gap-2">
        {status === "pending" && (
          <>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("verify")}
              className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}
            >
              {busy === "verify" ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("reject")}
              className={`${btn} bg-destructive text-white hover:bg-destructive/90`}
            >
              {busy === "reject" ? "Rejecting…" : "Reject"}
            </button>
          </>
        )}
        {status === "verified" && (
          <>
            <span className="text-xs text-success">Verified</span>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("suspend")}
              className={`${btn} border border-warning/30 bg-warning/10 text-warning-foreground hover:bg-warning/20`}
            >
              {busy === "suspend" ? "Suspending…" : "Suspend"}
            </button>
          </>
        )}
        {status === "suspended" && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run("reinstate")}
            className={`${btn} border border-input bg-card hover:bg-muted`}
          >
            {busy === "reinstate" ? "Reinstating…" : "Reinstate to review"}
          </button>
        )}
        {status === "rejected" && (
          <span className="text-xs text-destructive">Rejected</span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
