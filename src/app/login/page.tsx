"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { FcGoogle } from "react-icons/fc"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { logAuthFailure } from "@/app/login/actions"
import Link from "next/link"
import { SlideshowPanel } from "@/components/auth/SlideshowPanel"

// Password-reset resend cooldown: one successful request = one real email.
export const RESET_RESEND_COOLDOWN_MS = 60_000

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Resend cooldown: each successful request sends a real email, so rapid
  // re-clicks must not multiply sends. Success-only (failures stay retryable).
  const [resetCooldown, setResetCooldown] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      // Generic message prevents account enumeration (nonexistent vs wrong password vs unverified)
      const msg = "Invalid email or password. Please try again."
      setError(msg)
      const raw = err instanceof Error ? err.message : "unknown"
      logAuthFailure(raw, "login")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (err) {
      const raw = err instanceof Error ? err.message : ""
      const msg = raw.trim() ? raw : "Google sign-in failed. Please try again."
      setError(msg)
      logAuthFailure(raw || "blank provider error", "login")
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email || resetCooldown) return
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    // Always show generic success to prevent enumeration (Supabase itself returns success for non-existent emails, but we normalize all responses)
    if (error) {
      // Log raw for observability, show generic to user
      logAuthFailure(error.message, "login")
    }
    setError(null)
    setNotice("If an account exists for that email, a password reset link has been sent. Check your inbox.")
    setResetCooldown(true)
    window.setTimeout(() => setResetCooldown(false), RESET_RESEND_COOLDOWN_MS)
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-background flex">
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[var(--color-primary)]/40 blur-[140px]" />
      <div className="absolute -bottom-40 -right-20 w-[600px] h-[600px] rounded-full bg-[var(--color-primary)]/30 blur-[140px]" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-[var(--color-primary)]/20 blur-[120px]" />

      <div className="relative w-full min-h-screen grid grid-cols-1 md:grid-cols-2">
        <div className="hidden md:flex relative overflow-hidden border-r border-black/5">
          <SlideshowPanel />
        </div>

        <div className="flex flex-col justify-center p-8 sm:p-16 backdrop-blur-2xl backdrop-saturate-150 bg-white/40 border-l border-white/30 relative">
          <div className="md:hidden mb-8">
            <span className="text-xl font-semibold tracking-tight">Dealenz</span>
          </div>
          <h1 className="font-extrabold text-2xl text-foreground">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5 max-w-sm">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-foreground/80">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]/50 focus:ring-2 focus:ring-[var(--color-primary)]/10"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-foreground/80">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder=""
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                minLength={8}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]/50 focus:ring-2 focus:ring-[var(--color-primary)]/10"
              />
              <div className="mt-1.5 text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetCooldown}
                  className="text-sm text-[var(--color-primary)] hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {resetCooldown ? "Reset email sent — check your inbox" : "Forgot password?"}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-xl bg-[var(--color-primary)] text-white py-3.5 text-sm font-medium">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          {error && (
            <p role="alert" className="mt-4 max-w-sm text-sm text-destructive">{error}</p>
          )}
          {notice && (
            <p role="status" className="mt-4 max-w-sm text-sm text-success">{notice}</p>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="mt-4 w-full max-w-sm rounded-xl border border-black/10 bg-white py-3 text-sm font-medium flex items-center justify-center gap-2"
          >
            <FcGoogle className="h-5 w-5" />
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[var(--color-primary)] font-medium underline-offset-4 hover:no-underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}