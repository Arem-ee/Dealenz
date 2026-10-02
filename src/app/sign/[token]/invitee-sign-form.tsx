"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { declineTokenAction, signTokenAction } from "@/app/sign/[token]/actions"

// Invitee signing form: typed full name is the signature act, email must
// match the invitation (the RPC enforces the binding — a leaked token
// alone cannot sign as someone else).
export function InviteeSignForm({ token, invitedName, invitedEmail }: {
  token: string
  invitedName: string
  invitedEmail: string
}) {
  const router = useRouter()
  const [name, setName] = useState(invitedName)
  const [busy, setBusy] = useState<"sign" | "decline" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function sign() {
    if (busy) return
    setBusy("sign")
    setError(null)
    try {
      const res = await signTokenAction({ token, name, email: invitedEmail })
      if (!res.ok) throw new Error(res.error)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't record that signature.")
    } finally {
      setBusy(null)
    }
  }

  async function decline() {
    if (busy) return
    if (!window.confirm("Decline this invitation? This can't be undone.")) return
    setBusy("decline")
    setError(null)
    try {
      const res = await declineTokenAction({ token })
      if (!res.ok) throw new Error(res.error)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't record that.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="border border-border bg-background p-4">
      <p className="text-sm">Signing as <strong>{invitedName}</strong> ({invitedEmail})</p>
      <label className="mt-3 block text-[11px] font-medium text-muted-foreground" htmlFor="invitee-signature">
        Type your full name to sign
      </label>
      <input
        id="invitee-signature"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={busy !== null}
        autoComplete="off"
        placeholder="Full legal name"
        className="mt-1 h-10 w-full border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
      />
      {error && <p role="alert" className="mt-2 border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void sign()}
          disabled={busy !== null || !name.trim()}
          className="inline-flex h-10 flex-1 items-center justify-center bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy === "sign" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Sign document
        </button>
        <button
          type="button"
          onClick={() => void decline()}
          disabled={busy !== null}
          className="inline-flex h-10 items-center border border-border px-4 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {busy === "decline" && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Decline
        </button>
      </div>
    </div>
  )
}
