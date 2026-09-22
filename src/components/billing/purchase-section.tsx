"use client"

import { useState } from "react"
import { Loader2, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CREDIT_PACKAGES, formatPrice, packageValueLines, type Currency } from "@/lib/billing/catalog"

export function PurchaseSection() {
  const [currency, setCurrency] = useState<Currency>("USD")
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleBuy(packageId: string) {
    setLoading(packageId)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, currency }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Checkout failed")
      if (!data.url) throw new Error("No checkout URL returned")
      window.location.assign(data.url)
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
            <Button onClick={() => handleBuy(pkg.id)} disabled={loading !== null} className="mt-4 w-full" size="sm">
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
      {success && <div className="rounded-lg bg-success/10 p-3 text-xs text-success">{success}</div>}
      <p className="text-xs text-muted-foreground">Payment is verified server-side via signed webhooks. Returning from checkout does not mean payment succeeded — credits appear only after verified settlement and are idempotent.</p>
    </div>
  )
}
