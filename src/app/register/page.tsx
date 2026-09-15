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

function ComicBlobs() {
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[#FAFAF8] p-8 lg:p-10 overflow-hidden">
      <div className="absolute -top-24 -left-24 h-[380px] w-[380px] rounded-full bg-[#EDEBE7] blur-[60px] opacity-60" aria-hidden />
      <div className="absolute -bottom-20 -right-20 h-[420px] w-[420px] rounded-full bg-[#EDEBE7] blur-[70px] opacity-50" aria-hidden />
      <div className="relative w-full max-w-[420px]">
        <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-black/30 mb-6">Dealenz</p>
        <div className="space-y-4">
          <div className="relative rounded-[20px] border border-black/[0.07] bg-white px-5 py-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)] rotate-[-0.6deg]">
            <p className="text-[15px] font-medium leading-snug tracking-[-0.01em]">&ldquo;You don&apos;t need to know what to ask.&rdquo;</p>
            <div className="absolute -bottom-2 left-8 h-4 w-4 rotate-45 border-b border-r border-black/[0.07] bg-white" aria-hidden />
          </div>
          <div className="relative ml-8 rounded-[20px] border border-black/[0.07] bg-[#1C1917] px-5 py-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] rotate-[0.7deg]">
            <p className="text-[15px] font-medium leading-snug tracking-[-0.01em] text-white">
              &ldquo;Tell us what&apos;s happening. We&apos;ll ask what matters.&rdquo;
            </p>
            <div className="absolute -bottom-2 right-10 h-4 w-4 rotate-45 bg-[#1C1917]" aria-hidden />
          </div>
          <div className="relative rounded-[20px] border border-black/[0.07] bg-white px-5 py-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)] rotate-[-0.4deg]">
            <p className="text-[15px] font-medium leading-snug tracking-[-0.01em]">&ldquo;Know what you&apos;re dealing with — before you sign.&rdquo;</p>
            <div className="absolute -bottom-2 left-10 h-4 w-4 rotate-45 border-b border-r border-black/[0.07] bg-white" aria-hidden />
          </div>
          <div className="relative ml-6 rounded-[20px] border border-[var(--burgundy)]/15 bg-[var(--burgundy)]/[0.06] px-5 py-4 rotate-[0.5deg]">
            <p className="text-[15px] font-medium leading-snug tracking-[-0.01em] text-[#1C1917]">&ldquo;Your work stays yours.&rdquo;</p>
          </div>
        </div>
        <p className="mt-8 text-[12px] leading-relaxed text-black/40 max-w-[32ch]">From first question to signed agreement — the work stays connected.</p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const ref = (params.get("ref") ?? "").trim().toUpperCase()
      if (/^[A-Z0-9]{8}$/.test(ref)) {
        document.cookie = `dealenz_ref=${ref}; max-age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`
      }
    } catch {
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
      if (raw.toLowerCase().includes("already registered") || raw.toLowerCase().includes("already exists") || raw.toLowerCase().includes("user already")) {
        router.push("/dashboard?verify=true")
        router.refresh()
        return
      }
      setError("We couldn't create your account. Please try again.")
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
      const msg = "We couldn't start Google sign-in. Please try again."
      setError(msg)
      logAuthFailure(raw || "blank provider error", "register")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#FAFAF8] flex">
      <div className="hidden md:flex w-[46%] shrink-0 border-r border-black/5">
        <ComicBlobs />
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 bg-white">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[var(--burgundy)] text-[11px] font-bold tracking-[0.08em] text-white">D</span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">dealenz</span>
          </Link>

          <h1 className="mt-8 text-[22px] font-semibold tracking-[-0.02em]">Create an account</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-black/55">Get started in minutes. No credit card required.</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
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
                className="mt-1.5 h-11 rounded-xl border-black/10 bg-white px-4 text-[14px]"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-[12px] font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder=""
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
                className="mt-1.5 h-11 rounded-xl border-black/10 bg-white px-4 text-[14px]"
              />
              <p className="mt-1.5 text-[11px] text-black/40">At least 8 characters.</p>
            </div>
            <Button type="submit" disabled={loading} className="h-11 w-full rounded-full bg-[#1C1917] text-white text-[14px] font-medium hover:bg-black">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-relaxed text-red-800">
              {error}
            </p>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-black/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[11px] font-medium tracking-wide uppercase text-black/30">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-[13px] font-medium hover:bg-black/[0.02] transition-colors"
          >
            <FcGoogle className="h-[18px] w-[18px]" />
            Continue with Google
          </button>

          <p className="mt-6 text-center text-[13px] text-black/55">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#1C1917] underline decoration-black/20 underline-offset-4 hover:decoration-black/40">
              Sign in
            </Link>
          </p>
          <p className="mt-6 text-center text-[11px] leading-relaxed text-black/40">
            By creating an account you agree to our <Link href="/terms" className="underline decoration-black/20 underline-offset-2">Terms</Link> and{" "}
            <Link href="/privacy" className="underline decoration-black/20 underline-offset-2">Privacy</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
