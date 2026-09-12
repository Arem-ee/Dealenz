"use client"

import { useEffect, useState } from "react"
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

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Referral MVP (Phase 22): capture ?ref=CODE into a short-lived cookie so
  // the server can attribute the signup after the account exists. The code
  // is untrusted input; the server validates it against referral_codes.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const ref = (params.get("ref") ?? "").trim().toUpperCase()
      if (/^[A-Z0-9]{8}$/.test(ref)) {
        document.cookie = `dealenz_ref=${ref}; max-age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`
      }
    } catch {
      // Referral capture is opportunistic only.
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      router.push("/dashboard?verify=true")
      router.refresh()
    } catch (err) {
      const raw = err instanceof Error ? err.message : "unknown"
      // Prevent enumeration: "already registered" → generic success path
      if (raw.toLowerCase().includes("already registered") || raw.toLowerCase().includes("already exists") || raw.toLowerCase().includes("user already")) {
        router.push("/dashboard?verify=true")
        router.refresh()
        return
      }
      setError("Unable to create account. Please try again.")
      logAuthFailure(raw, "register")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)

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
      logAuthFailure(raw || "blank provider error", "register")
      setLoading(false)
    }
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
          <h1 className="font-extrabold text-2xl text-foreground">Create an account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Get a risk report on your first deal in minutes, free</p>

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
                autoComplete="new-password"
                minLength={8}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]/50 focus:ring-2 focus:ring-[var(--color-primary)]/10"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-xl bg-[var(--color-primary)] text-white py-3.5 text-sm font-medium">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>

          {error && (
            <p role="alert" className="mt-4 max-w-sm text-sm text-destructive">{error}</p>
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
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--color-primary)] font-medium underline-offset-4 hover:no-underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}