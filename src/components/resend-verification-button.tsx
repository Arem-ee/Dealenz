"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { resendVerification } from "@/app/login/actions"

// Verification resend with honest feedback: pending while sending, success
// confirmation, and a 60-second cooldown against double-taps. The server
// action enforces its own daily cap; this is UX, not the gate.
const COOLDOWN_S = 60

export function ResendVerificationButton() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (state === "sending" || cooldown > 0) return
    setState("sending")
    setError(null)
    try {
      const res = await resendVerification()
      if (!res.success) {
        setError(res.error ?? "We couldn't send that. Please try again in a minute.")
        setState("error")
        return
      }
      setState("sent")
      setCooldown(COOLDOWN_S)
      const timer = window.setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            window.clearInterval(timer)
            return 0
          }
          return c - 1
        })
      }, 1000)
    } catch {
      setError("We couldn't send that. Please try again in a minute.")
      setState("error")
    }
  }

  return (
    <div className="w-full">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={state === "sending" || cooldown > 0}
        onClick={() => void handleClick()}
      >
        {state === "sending" ? "Sending…" : cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend verification email"}
      </Button>
      {state === "sent" && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Sent — check your inbox and spam folder. The link expires after 24 hours.
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error ?? "We couldn't send that. Please try again in a minute."}
        </p>
      )}
    </div>
  )
}
