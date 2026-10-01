"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { FcGoogle } from "react-icons/fc"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { logAuthFailure } from "@/app/login/actions"
import { resolveNextPath } from "@/lib/auth/link"
import { parseSsoDomain, ssoErrorMessage } from "@/lib/auth/sso"
import { FounderNote } from "@/components/auth/founder-note"
import Link from "next/link"

export const RESET_RESEND_COOLDOWN_MS = 60_000

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetCooldown, setResetCooldown] = useState(false)
  const [ssoOpen, setSsoOpen] = useState(false)
  const [ssoDomain, setSsoDomain] = useState("")
  const [ssoLoading, setSsoLoading] = useState(false)
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [mfaCode, setMfaCode] = useState("")

  function loginDestination(): string {
    return resolveNextPath(new URLSearchParams(window.location.search).get("next"))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const verified = (factors?.totp ?? []).find((f) => f.status === "verified")
        if (!verified) throw new Error("Two-factor required but no verified authenticator found. Contact support.")
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: verified.id })
        if (challengeError || !challenge) throw challengeError ?? new Error("Could not start two-factor verification.")
        setMfaChallenge({ factorId: verified.id, challengeId: challenge.id })
        setMfaCode("")
        return
      }
      router.push(loginDestination())
      router.refresh()
    } catch (err) {
      const msg = "We couldn't sign you in. Check your email and password and try again."
      setError(msg)
      const raw = err instanceof Error ? err.message : "unknown"
      logAuthFailure(raw, "login")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(loginDestination())}`,
        },
      })
      if (error) throw error
    } catch (err) {
      const raw = err instanceof Error ? err.message : ""
      const msg = "We couldn't start Google sign-in. Please try again."
      setError(msg)
      logAuthFailure(raw || "blank provider error", "login")
      setLoading(false)
    }
  }

  const handleSsoSignIn = async () => {
    const domain = parseSsoDomain(ssoDomain)
    if (!domain) {
      setError("Enter your work email domain, e.g. acme.com.")
      return
    }
    setSsoLoading(true)
    setError(null)
    setNotice(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithSSO({
        domain,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(loginDestination())}`,
        },
      })
      if (error) throw error
    } catch (err) {
      const raw = err instanceof Error ? err.message : ""
      setError(ssoErrorMessage(raw))
      logAuthFailure(raw || "sso start failed", "login")
      setSsoLoading(false)
    }
  }

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaChallenge || mfaCode.trim().length < 6 || loading) return
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaChallenge.factorId,
        challengeId: mfaChallenge.challengeId,
        code: mfaCode.trim(),
      })
      if (error) throw error
      router.push(loginDestination())
      router.refresh()
    } catch {
      setError("That code didn't verify. Check your authenticator app and try again.")
      logAuthFailure("mfa verify failed", "login")
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email || resetCooldown) return
    const supabase = createClient()
    // Explicit recovery landing: without redirectTo the emailed link drops
    // the user on the homepage with tokens nothing consumes (dead end).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) {
      logAuthFailure(error.message, "login")
    }
    setError(null)
    setNotice("If an account exists for that email, a password reset link has been sent. Check your inbox.")
    setResetCooldown(true)
    window.setTimeout(() => setResetCooldown(false), RESET_RESEND_COOLDOWN_MS)
  }

  return (
    <div className="min-h-screen w-full bg-background flex">
      <div className="hidden md:flex w-[46%] shrink-0 border-r border-border">
        <FounderNote />
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 bg-card">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-[7px]">
              <Image src="/favicon.svg" alt="Dealenz logo" fill className="object-cover" priority />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">dealenz</span>
          </Link>

          <h1 className="mt-8 text-[22px] font-semibold tracking-[-0.02em]">Welcome back</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/55">Sign in to continue your work.</p>

          <form onSubmit={mfaChallenge ? handleVerifySubmit : handleSubmit} className="mt-7 space-y-4" noValidate>
            {mfaChallenge ? (
              <div>
                <Label htmlFor="mfa-code" className="text-[12px] font-medium">
                  Authenticator code
                </Label>
                <p className="mt-1 text-[12px] text-foreground/55">Two-factor is on for this account. Enter the 6-digit code.</p>
                <Input
                  id="mfa-code"
                  type="text"
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  required
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  className="mt-1.5 h-11 rounded-xl border-border bg-card px-4 text-[14px]"
                />
                <Button type="submit" disabled={loading || mfaCode.trim().length < 6} className="mt-4 h-11 w-full rounded-full bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/85">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
                <button
                  type="button"
                  onClick={() => { setMfaChallenge(null); setMfaCode("") }}
                  className="mt-2 w-full text-center text-[12px] font-medium text-foreground/55 hover:text-foreground"
                >
                  Back to password sign-in
                </button>
              </div>
            ) : (
              <>
            <div>
              <Label htmlFor="email" className="text-[12px] font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1.5 h-11 rounded-xl border-border bg-card px-4 text-[14px]"
              />
            </div>
            <div className="relative">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[12px] font-medium">
                  Password
                </Label>
              </div>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder=""
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                minLength={8}
                className="mt-1.5 h-11 rounded-xl border-border bg-card px-4 pr-11 text-[14px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-[38px] text-foreground/40 hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetCooldown}
                  className="text-[12px] font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {resetCooldown ? "Check your inbox for the reset link" : "Forgot password?"}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="h-11 w-full rounded-full bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/85">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
              </>
            )}
          </form>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-[13px] leading-relaxed text-foreground">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-4 rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-[13px] leading-relaxed text-foreground">
              {notice}
            </p>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-[11px] font-medium tracking-wide uppercase text-foreground/30">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-card text-[13px] font-medium hover:bg-foreground/[0.02] transition-colors"
          >
            <FcGoogle className="h-[18px] w-[18px]" />
            Continue with Google
          </button>

          <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20">
            <button
              type="button"
              onClick={() => setSsoOpen((v) => !v)}
              aria-expanded={ssoOpen}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-[13px] font-medium">Continue with SSO</span>
              <span className="text-[11px] text-foreground/50">{ssoOpen ? "Hide" : "SAML · OIDC"}</span>
            </button>
            {ssoOpen && (
              <div className="flex gap-2 px-4 pb-4">
                <label htmlFor="sso-domain" className="sr-only">Work email domain</label>
                <Input
                  id="sso-domain"
                  type="text"
                  placeholder="acme.com"
                  value={ssoDomain}
                  onChange={(e) => setSsoDomain(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void handleSsoSignIn()
                    }
                  }}
                  autoComplete="organization"
                  className="h-10 min-w-0 flex-1 rounded-xl border-border bg-card px-3.5 text-[13px]"
                />
                <Button
                  type="button"
                  onClick={() => void handleSsoSignIn()}
                  disabled={ssoLoading}
                  className="h-10 shrink-0 rounded-full px-4 text-[13px]"
                >
                  {ssoLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Go
                </Button>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-[13px] text-foreground/55">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-foreground underline decoration-foreground/20 underline-offset-4 hover:decoration-foreground/40">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
