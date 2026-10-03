"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import {
  declineTokenAction,
  forwardTokenAction,
  saveArtifactAction,
  signTokenAction,
} from "@/app/sign/[token]/actions"
import { SignaturePad } from "@/components/sign/signature-pad"
import type { SignatureMethod } from "@/lib/signatures/validate"

// Invitee signing: review, adopt a drawn or typed signature (recorded
// artifact-first, so no signature lands without its image), confirm the
// electronic-signature disclosure, then sign. Email binds server-side —
// a leaked token alone cannot sign as someone else.
export function InviteeSignForm({ token, invitedName, invitedEmail, earlierPending, allowForward }: {
  token: string
  invitedName: string
  invitedEmail: string
  earlierPending: number
  allowForward: boolean
}) {
  const router = useRouter()
  const [imageData, setImageData] = useState<string | null>(null)
  const [method, setMethod] = useState<SignatureMethod>("drawn")
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<"sign" | "decline" | "forward" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [forwardOpen, setForwardOpen] = useState(false)
  const [forwardName, setForwardName] = useState("")
  const [forwardEmail, setForwardEmail] = useState("")
  const [forwardedLink, setForwardedLink] = useState<string | null>(null)

  const waiting = earlierPending > 0
  const canSign = imageData !== null && consent && !waiting && busy === null

  async function sign() {
    if (!canSign || !imageData) return
    setBusy("sign")
    setError(null)
    try {
      const saved = await saveArtifactAction({ token, email: invitedEmail, imageData, method })
      if (!saved.ok) throw new Error(saved.error)
      const res = await signTokenAction({ token, name: invitedName, email: invitedEmail, consent })
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

  async function forward() {
    if (busy) return
    setBusy("forward")
    setError(null)
    try {
      const res = await forwardTokenAction({ token, name: forwardName, email: forwardEmail })
      if (!res.ok) throw new Error(res.error)
      setForwardedLink(`${window.location.origin}/sign/${res.newToken}`)
      setForwardOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't forward that invitation.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="border border-border bg-background p-4">
      <p className="text-sm">Signing as <strong>{invitedName}</strong> ({invitedEmail})</p>

      {waiting && (
        <p role="status" className="mt-2 border border-border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
          Earlier signers haven&apos;t signed yet — this step unlocks when theirs is done. Review the document meanwhile.
        </p>
      )}

      <div className="mt-3">
        <p className="text-[11px] font-medium text-muted-foreground">Adopt your signature</p>
        <div className="mt-1">
          <SignaturePad
            disabled={busy !== null}
            onChange={(data, m) => {
              setImageData(data)
              setMethod(m)
            }}
          />
        </div>
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={busy !== null}
          className="mt-0.5 h-3.5 w-3.5 accent-foreground"
        />
        <span className="text-muted-foreground">
          I agree to sign this document electronically. My drawn or typed signature carries the same
          legal effect as a handwritten one.
        </span>
      </label>

      {error && <p role="alert" className="mt-2 border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void sign()}
          disabled={!canSign}
          title={waiting ? "Earlier signers must sign first" : imageData === null ? "Draw or type your signature first" : !consent ? "Confirm the electronic-signature disclosure first" : undefined}
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

      {allowForward && !forwardedLink && (
        <div className="mt-3 border-t border-border pt-3">
          {!forwardOpen ? (
            <button
              type="button"
              onClick={() => setForwardOpen(true)}
              disabled={busy !== null}
              className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Wrong person? Forward to a colleague
            </button>
          ) : (
            <div>
              <p className="text-xs font-medium">Forward this invitation</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Your invitation is revoked and the step moves to them with the same deadline.
              </p>
              <div className="mt-2 flex flex-col gap-1.5 sm:flex-row">
                <input
                  value={forwardName}
                  onChange={(e) => setForwardName(e.target.value)}
                  disabled={busy !== null}
                  placeholder="Colleague name"
                  aria-label="Colleague name"
                  autoComplete="off"
                  className="h-9 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none disabled:opacity-60"
                />
                <input
                  value={forwardEmail}
                  onChange={(e) => setForwardEmail(e.target.value)}
                  disabled={busy !== null}
                  placeholder="colleague@example.com"
                  aria-label="Colleague email"
                  autoComplete="off"
                  className="h-9 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void forward()}
                  disabled={busy !== null || !forwardName.trim() || !forwardEmail.trim()}
                  className="h-9 shrink-0 border border-border px-2.5 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
                >
                  {busy === "forward" ? "Forwarding…" : "Forward"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {forwardedLink && (
        <p role="status" className="mt-3 break-all border border-border bg-muted/40 px-2.5 py-2 text-[11px]">
          Forwarded. Send your colleague this link: {forwardedLink}
        </p>
      )}
    </div>
  )
}
