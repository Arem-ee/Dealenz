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

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred"
      setError(msg)
      logAuthFailure(msg, "login")
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
      const msg = err instanceof Error ? err.message : "Google sign-in failed"
      setError(msg)
      logAuthFailure(msg, "login")
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) return
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      alert("Password reset email sent. Check your inbox.")
    }
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[#F2F0ED] flex">
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[var(--color-primary)]/40 blur-[140px]" />
      <div className="absolute -bottom-40 -right-20 w-[600px] h-[600px] rounded-full bg-[var(--color-primary)]/30 blur-[140px]" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-[var(--color-primary)]/20 blur-[120px]" />

      <div className="relative w-full min-h-screen grid grid-cols-1 md:grid-cols-2">
        <div className="hidden md:flex flex-col justify-between p-12 lg:p-16 backdrop-blur-2xl backdrop-saturate-150 bg-[var(--color-primary)]/30 border-r border-white/20 relative overflow-hidden">
          <div className="relative z-10">
            <span className="text-2xl font-semibold tracking-tight text-white">Dealenz</span>
          </div>
          <div className="relative z-10">
            <SlideshowPanel />
          </div>
        </div>

        <div className="flex flex-col justify-center p-8 sm:p-16 backdrop-blur-2xl backdrop-saturate-150 bg-white/40 border-l border-white/30 relative">
          <div className="md:hidden mb-8">
            <span className="text-xl font-semibold tracking-tight">Dealenz</span>
          </div>
          <h1 className="font-extrabold text-2xl text-[#141110]">Welcome back</h1>
          <p className="mt-1 text-sm text-[#141110]/60">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5 max-w-sm">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-[#141110]/80">Email</Label>
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
                <Label htmlFor="password" className="text-sm font-medium text-[#141110]/80">Password</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-[var(--color-primary)] hover:underline"
                >
                  Forgot password?
                </button>
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
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-xl bg-[var(--color-primary)] text-white py-3.5 text-sm font-medium">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="mt-4 w-full max-w-sm rounded-xl border border-black/10 bg-white py-3 text-sm font-medium flex items-center justify-center gap-2"
          >
            <FcGoogle className="h-5 w-5" />
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-[#141110]/60">
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