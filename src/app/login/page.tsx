"use client"

import { useEffect, useState } from "react"
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
import Link from "next/link"

export const RESET_RESEND_COOLDOWN_MS = 60_000

const QUOTES = [
  "Nothing is as good or as bad as it seems.",
  "The fine print isn't hiding. You just weren't looking.",
  "Most bad deals aren't a trap. They're just unread.",
  "A handshake is a feeling. A contract is a fact.",
  "You can't negotiate what you haven't noticed.",
  "The best time to ask a question is before you sign.",
  "Trust the deal. Verify the paperwork.",
  "Every clause was written by someone with a goal. What's theirs?",
]

function BubbleShape({ tone }: { tone: "light" | "dark" | "tint" }) {
  const fill = tone === "dark" ? "#1C1917" : tone === "tint" ? "#F5EDED" : "#FFFFFF"
  const stroke = tone === "tint" ? "rgba(90,20,30,0.18)" : "rgba(0,0,0,0.08)"
  return (
    <svg
      aria-hidden
      viewBox="0 0 360 132"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
    >
      <rect x="2" y="2" width="356" height="110" rx="24" fill={fill} stroke={stroke} strokeWidth="2" />
      <path d="M52 112 L40 130 L74 112 Z" fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      <rect x="2" y="2" width="356" height="110" rx="24" fill="none" stroke="#FFFFFF" strokeWidth="0" />
    </svg>
  )
}

function ComicBlobs() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % QUOTES.length)
    }, 4200)
    return () => window.clearInterval(id)
  }, [paused])

  const visible = [0, 1, 2].map((offset) => QUOTES[(index + offset) % QUOTES.length])
  const tones: Array<"light" | "dark" | "tint"> = ["light", "dark", "tint"]
  const tilts = ["rotate-[-0.6deg]", "rotate-[0.7deg]", "rotate-[-0.4deg]"]
  const offsets = ["", "ml-8", "ml-4"]

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#FAFAF8] p-8 lg:p-10">
      <div className="absolute -left-24 -top-24 h-[380px] w-[380px] rounded-full bg-[#EDEBE7] opacity-60 blur-[60px]" aria-hidden />
      <div className="absolute -bottom-20 -right-20 h-[420px] w-[420px] rounded-full bg-[#EDEBE7] opacity-50 blur-[70px]" aria-hidden />

      <div className="relative w-full max-w-[420px]">
        <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-black/30">Dealenz</p>

        <div
          className="space-y-5"
          aria-live="polite"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {visible.map((quote, i) => (
            <div key={`${index}-${i}`} className={`relative ${offsets[i]} ${tilts[i]}`}>
              <div className="relative px-6 pb-8 pt-5">
                <BubbleShape tone={tones[i]} />
                <p
                  className={`relative text-[15px] font-medium leading-snug tracking-[-0.01em] ${
                    tones[i] === "dark" ? "text-white" : "text-[#1C1917]"
                  }`}
                >
                  &ldquo;{quote}&rdquo;
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2" role="tablist" aria-label="Quote selector">
          {QUOTES.map((quote, i) => (
            <button
              key={quote}
              role="tab"
              aria-selected={i === index}
              aria-label={`Show quote ${i + 1}`}
              onClick={() => {
                setIndex(i)
                setPaused(true)
                window.setTimeout(() => setPaused(false), 8000)
              }}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === index ? "bg-[#1C1917]" : "bg-black/15 hover:bg-black/25"
              }`}
            />
          ))}
        </div>

        <p className="mt-6 max-w-[32ch] text-[12px] leading-relaxed text-black/40">
          You do not need to know what to ask. Just explain what is happening.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetCooldown, setResetCooldown] = useState(false)

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

  const handleGoogleSignIn = async () => {
    setLoading(true)
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

  const handleForgotPassword = async () => {
    if (!email || resetCooldown) return
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      logAuthFailure(error.message, "login")
    }
    setError(null)
    setNotice("If an account exists for that email, a password reset link has been sent. Check your inbox.")
    setResetCooldown(true)
    window.setTimeout(() => setResetCooldown(false), RESET_RESEND_COOLDOWN_MS)
  }

  return (
    <div className="min-h-screen w-full bg-[#FAFAF8] flex">
      <div className="hidden md:flex w-[46%] shrink-0 border-r border-black/5">
        <ComicBlobs />
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 bg-white">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-[7px]">
              <Image src="/favicon.svg" alt="Dealenz logo" fill className="object-cover" priority />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">dealenz</span>
          </Link>

          <h1 className="mt-8 text-[22px] font-semibold tracking-[-0.02em]">Welcome back</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-black/55">Sign in to continue your work.</p>

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
                className="mt-1.5 h-11 rounded-xl border-black/10 bg-white px-4 pr-11 text-[14px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-[38px] text-black/40 hover:text-black"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetCooldown}
                  className="text-[12px] font-medium text-[var(--burgundy)] hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {resetCooldown ? "Check your inbox for the reset link" : "Forgot password?"}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="h-11 w-full rounded-full bg-[#1C1917] text-white text-[14px] font-medium hover:bg-black">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-relaxed text-red-800">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[13px] leading-relaxed text-emerald-800">
              {notice}
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
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-[#1C1917] underline decoration-black/20 underline-offset-4 hover:decoration-black/40">
              Create account
            </Link>
          </p>
          <p className="mt-2 text-center text-[12px] text-black/40">
            Applying as a lawyer?{" "}
            <Link href="/lawyer-application" className="font-medium underline decoration-black/20 underline-offset-4 hover:decoration-black/40">
              Apply to join Dealenz
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
