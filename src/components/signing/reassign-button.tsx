"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { revokeSignerInvite } from "@/app/signing/actions"

export function ReassignButton({ auditId, signerId, currentName }: { auditId: string; signerId: string; currentName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reassign() {
    if (busy) return
    const cleanName = name.trim()
    const cleanEmail = email.trim()
    if (!cleanName) {
      setError("Enter the replacement signer's name.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Enter a valid email for the replacement signer.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const revoked = await revokeSignerInvite(auditId, signerId)
      if (!revoked.ok) {
        setError(revoked.error)
        return
      }
      const res = await fetch(`/api/document/${auditId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName, email: cleanEmail }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        setError(data.error ?? "Revoked the old invite, but the new invite failed. Re-invite from the document page.")
        router.refresh()
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setError(null) }}
        aria-label={`Reassign ${currentName} to someone else`}
        className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        Reassign
      </button>
    )
  }

  return (
    <span className="flex min-w-[200px] shrink-0 flex-col gap-1.5 rounded-xl border border-border bg-background p-2.5">
      <label className="block text-[11px] font-medium">
        Replacement name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          className="mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-normal"
        />
      </label>
      <label className="block text-[11px] font-medium">
        Replacement email
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          className="mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-normal"
        />
      </label>
      {error && <span role="alert" className="text-[10px] text-destructive">{error}</span>}
      <span className="flex gap-1.5">
        <button
          type="button"
          onClick={() => void reassign()}
          disabled={busy}
          className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Working…" : "Replace"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          disabled={busy}
          className="rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </span>
    </span>
  )
}
