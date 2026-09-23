"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CREDIT_PACKAGES, formatPrice, packageValueLines, type Currency } from "@/lib/billing/catalog"
import { createClient } from "@/lib/supabase/client"

// Minimal Paddle.js surface (no @types package; guarded at runtime).
interface PaddleCheckout {
  open: (options: Record<string, unknown>) => void
  close: () => void
}
interface PaddleJs {
  Initialize: (options: Record<string, unknown>) => void
  Checkout: PaddleCheckout
}
declare global {
  interface Window {
    Paddle?: PaddleJs
  }
}

let paddleScriptPromise: Promise<PaddleJs | null> | null = null

function loadPaddleJs(): Promise<PaddleJs | null> {
  if (typeof window === "undefined") return Promise.resolve(null)
  if (window.Paddle) return Promise.resolve(window.Paddle)
  if (!paddleScriptPromise) {
    paddleScriptPromise = new Promise((resolve) => {
      const script = document.createElement("script")
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js"
      script.async = true
      script.onload = () => resolve(window.Paddle ?? null)
      script.onerror = () => resolve(null)
      document.head.appendChild(script)
      // Never hang the buy flow on a blocked CDN.
      setTimeout(() => resolve(window.Paddle ?? null), 8000)
    })
  }
  return paddleScriptPromise
}

let paddleInitialized = false

// Paddle composes API-transaction checkout URLs as
// <default-payment-link>/?ptxn=<txn-id>, which only works on a page that
// includes Paddle.js. Ours don't — so a URL pointing at our own domain is
// a dead end (renders the homepage), never a checkout. Only follow URLs
// on Paddle's own checkout hosts.
function isPaddleHostedCheckout(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.endsWith("paddle.com") || host.endsWith("paddle.net")
  } catch {
    return false
  }
}

function paddleEnvironment(): "sandbox" | "production" {
  // Client-side tokens are prefixed live_/test_ — derive the environment
  // from the token itself so no second env var can drift out of sync.
  const token = (process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "").trim()
  return token.startsWith("test_") ? "sandbox" : "production"
}

async function readBalance(): Promise<number | null> {
  try {
    const supabase = createClient()
    const { data } = await supabase.rpc("credit_balance")
    if (Array.isArray(data) && data[0] && typeof (data[0] as Record<string, unknown>).balance === "number") {
      return Math.floor((data[0] as { balance: number }).balance)
    }
    if (data && typeof (data as Record<string, unknown>).balance === "number") {
      return Math.floor((data as { balance: number }).balance)
    }
    return null
  } catch {
    return null
  }
}

export function PurchaseSection() {
  const router = useRouter()
  const [currency, setCurrency] = useState<Currency>("USD")
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [])

  // After Paddle confirms payment, the webhook still needs a moment to
  // settle credits. Poll the balance until it moves, then refresh.
  function pollForCredits(baseline: number | null) {
    if (pollTimer.current) clearInterval(pollTimer.current)
    if (baseline === null) {
      setSuccess("Payment received — credits land within a minute. Refresh to see them.")
      router.refresh()
      return
    }
    setConfirming(true)
    const deadline = Date.now() + 90000
    pollTimer.current = setInterval(async () => {
      const now = await readBalance()
      if (now !== null && now > baseline) {
        if (pollTimer.current) clearInterval(pollTimer.current)
        setConfirming(false)
        setSuccess(`Payment received — ${now - baseline} credits added.`)
        router.refresh()
        return
      }
      if (Date.now() > deadline) {
        if (pollTimer.current) clearInterval(pollTimer.current)
        setConfirming(false)
        setSuccess("Payment received — credits land within a minute. Check purchase history below.")
        router.refresh()
      }
    }, 5000)
  }

  async function openOverlayCheckout(transactionId: string, baseline: number | null): Promise<boolean> {
    const token = (process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "").trim()
    if (!token) return false
    const paddle = await loadPaddleJs()
    if (!paddle) return false
    try {
      if (!paddleInitialized) {
        paddle.Initialize({
          token,
          environment: paddleEnvironment(),
          eventCallback: (data: unknown) => {
            const name = (data as { name?: unknown } | null)?.name
            if (name === "checkout.completed") {
              try {
                paddle.Checkout.close()
              } catch {
                // Overlay already gone; fall through to confirmation.
              }
              pollForCredits(baseline)
            } else if (name === "checkout.closed") {
              // Closed early (or after Paddle's own success screen): refresh
              // in case the webhook already settled credits.
              router.refresh()
            } else if (name === "checkout.error") {
              setError("The payment page reported a problem — no credits were charged. Check Paddle dashboard configuration, then try again.")
            }
          },
        })
        paddleInitialized = true
      }
      paddle.Checkout.open({
        transactionId,
        settings: {
          displayMode: "overlay",
          theme: typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light",
        },
      })
      return true
    } catch {
      return false
    }
  }

  async function handleBuy(packageId: string) {
    setLoading(packageId)
    setError(null)
    setSuccess(null)
    try {
      const baseline = await readBalance()
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, currency }),
      })
      const data = (await res.json()) as { url?: string; checkoutId?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Checkout failed")
      if (!data.url) throw new Error("No checkout URL returned")
      // Prefer the in-app overlay (no navigation away); fall back to the
      // hosted checkout URL only when it actually points at Paddle.
      // A same-domain ?ptxn= URL needs Paddle.js on that page (ours have
      // none) and would strand the buyer on the homepage — surface an
      // error instead of navigating to a dead end.
      if (data.checkoutId && data.checkoutId.startsWith("txn_")) {
        const opened = await openOverlayCheckout(data.checkoutId, baseline)
        if (opened) {
          setLoading(null)
          return
        }
      }
      if (isPaddleHostedCheckout(data.url)) {
        window.location.assign(data.url)
        return
      }
      throw new Error("Checkout is not available right now")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed")
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Buy credits</h2>
        <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="h-8 rounded-md border border-input bg-background px-2 text-xs" aria-label="Currency">
          <option value="USD">USD $</option>
          <option value="GBP">GBP £</option>
          <option value="EUR">EUR €</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground">Credits work for all deal types — founder, partnership, and freelance. No subscriptions. Secure checkout with international cards and tax handled at checkout.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {CREDIT_PACKAGES.filter((p) => p.active).map((pkg) => (
          <div key={pkg.id} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <p className="text-sm font-medium">{pkg.credits} credits</p>
            <p className="mt-1 text-2xl font-bold">
              {formatPrice(pkg.prices[currency], currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{pkg.description}</p>
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {packageValueLines(pkg.credits).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <Button onClick={() => void handleBuy(pkg.id)} disabled={loading !== null} className="mt-4 w-full" size="sm">
              {loading === pkg.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Buy credits
            </Button>
          </div>
        ))}
      </div>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
          {error} — no credits were charged. Try again or pick a different package.
        </div>
      )}
      {(success || confirming) && (
        <div className="rounded-lg bg-success/10 p-3 text-xs text-success">
          {confirming ? "Confirming your payment…" : success}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Payment is verified server-side via signed webhooks. Returning from checkout does not mean payment succeeded — credits appear only after verified settlement and are idempotent.</p>
    </div>
  )
}
