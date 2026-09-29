"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface TotpFactor {
  id: string
  friendly_name?: string | null
  status?: string | null
}

export function MfaSection() {
  const [factors, setFactors] = useState<TotpFactor[] | null>(null)
  const [enrolling, setEnrolling] = useState<{ factorId: string; secret: string } | null>(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unenrolling, setUnenrolling] = useState<string | null>(null)

  async function refresh() {
    try {
      const supabase = createClient()
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) throw listError
      setFactors(((data?.totp ?? []) as TotpFactor[]).filter((f) => f.status === "verified"))
    } catch {
      setFactors([])
    }
  }

  useEffect(() => {
    let cancelled = false
    createClient()
      .auth.mfa.listFactors()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setFactors([])
        else setFactors(((data?.totp ?? []) as TotpFactor[]).filter((f) => f.status === "verified"))
      })
      .catch(() => {
        if (!cancelled) setFactors([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function startEnroll() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Dealenz" })
      if (enrollError || !data) throw enrollError ?? new Error("Enrollment failed.")
      setEnrolling({ factorId: data.id, secret: data.totp.secret })
      setCode("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't start enrollment. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnroll() {
    if (!enrolling || code.trim().length < 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId })
      if (challengeError || !challenge) throw challengeError ?? new Error("Challenge failed.")
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      })
      if (verifyError) throw verifyError
      setEnrolling(null)
      setCode("")
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code didn't verify. Check your authenticator app and try again.")
    } finally {
      setBusy(false)
    }
  }

  async function unenroll(factorId: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId })
      if (unenrollError) throw unenrollError
      setUnenrolling(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't remove that factor. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Two-factor authentication</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          TOTP authenticator apps (Google Authenticator, 1Password, Authy). Required on every new device after enrollment.
        </p>
      </div>

      {factors === null ? (
        <p className="text-xs text-muted-foreground">Checking enrolled factors…</p>
      ) : factors.length > 0 ? (
        <ul className="space-y-2">
          {factors.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{f.friendly_name || "Authenticator app"}</p>
                <p className="text-xs text-muted-foreground">Verified — codes required at sign-in</p>
              </div>
              {unenrolling === f.id ? (
                <span className="flex shrink-0 items-center gap-1.5">
                  <Button variant="destructive" size="sm" disabled={busy} onClick={() => void unenroll(f.id)}>
                    Confirm remove
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setUnenrolling(null)}>
                    Keep
                  </Button>
                </span>
              ) : (
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setUnenrolling(f.id)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !enrolling && (
          <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Not enabled. Password-only sign-in.</p>
            <Button variant="outline" size="sm" className="shrink-0" disabled={busy} onClick={() => void startEnroll()}>
              Enable
            </Button>
          </div>
        )
      )}

      {enrolling && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Enter this secret in your authenticator app, then type the 6-digit code it shows.
          </p>
          <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs break-all select-all">{enrolling.secret}</p>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Label htmlFor="mfa-code" className="sr-only">Authenticator code</Label>
              <Input
                id="mfa-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="h-9"
              />
            </div>
            <Button size="sm" className="h-9 shrink-0" disabled={busy || code.trim().length < 6} onClick={() => void confirmEnroll()}>
              Verify
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 shrink-0"
              disabled={busy}
              onClick={() => { setEnrolling(null); setCode(""); setError(null) }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
