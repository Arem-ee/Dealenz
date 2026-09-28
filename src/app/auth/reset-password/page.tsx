"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const dynamic = "force-dynamic"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<"verifying" | "ready" | "done" | "invalid">("verifying")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function exchange() {
      const supabase = createClient()
      // PKCE recovery links arrive as ?code=…&type=recovery. Without this
      // exchange there is no session and the form below can never succeed.
      const code = searchParams.get("code")
      if (!code) {
        // Implicit-flow links (#access_token) are picked up by supabase-js
        // from the URL automatically; check for an existing session.
        const { data } = await supabase.auth.getSession()
        if (!cancelled) setPhase(data.session ? "ready" : "invalid")
        return
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!cancelled) setPhase(error ? "invalid" : "ready")
    }
    void exchange()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  async function handleSave() {
    if (password.length < 8) {
      setError("Use at least 8 characters.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError("Could not update the password. Request a fresh link and try again.")
        return
      }
      setPhase("done")
      await supabase.auth.signOut()
      router.push("/login")
    } catch {
      setError("Could not update the password. Request a fresh link and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-[15px] font-semibold tracking-[-0.02em]">dealenz</Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Set a new password</h1>
        {phase === "verifying" && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your reset link…
          </p>
        )}
        {phase === "invalid" && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              That link is invalid or expired. Request a fresh one from the sign-in page.
            </p>
            <Link href="/login" className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
              Back to sign in
            </Link>
          </div>
        )}
        {phase === "ready" && (
          <div className="mt-5 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSave()
                }}
                placeholder="At least 8 characters"
              />
            </div>
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
            <Button onClick={() => void handleSave()} disabled={saving} className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save new password
            </Button>
          </div>
        )}
        {phase === "done" && (
          <p className="mt-3 text-sm text-muted-foreground">Saved. Taking you back to sign in…</p>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
