"use client"

import { useEffect, useState } from "react"
import { Gift, Copy, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMyReferralCode, getMyReferrals, type ReferralAttributionView } from "@/app/billing/actions"
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/policy"
import { ClientTime } from "@/components/datetime"

function statusLabel(status: ReferralAttributionView["status"]): string {
  if (status === "rewarded") return "Rewarded"
  if (status === "qualified") return "Qualified"
  return "Pending"
}

export function ReferralSection() {
  const [code, setCode] = useState<string | null>(null)
  const [referrals, setReferrals] = useState<ReferralAttributionView[]>([])
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [codeRes, refsRes] = await Promise.all([getMyReferralCode(), getMyReferrals()])
      if (cancelled) return
      if (!codeRes.success) {
        setError(codeRes.error ?? "Could not load referrals")
        setLoading(false)
        return
      }
      setCode(codeRes.code ?? null)
      if (refsRes.success && refsRes.referrals) setReferrals(refsRes.referrals)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const link = code && typeof window !== "undefined" ? `${window.location.origin}/register?ref=${code}` : ""

  const handleCopy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Could not copy the link")
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <Gift className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-medium">Refer friends</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Share your link: when someone you invite completes their first deal analysis, you receive{" "}
            {REFERRAL_REWARD_CREDITS} credits. Early program — reward terms may change.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2" aria-label="Loading referrals">
          <div className="h-9 animate-pulse rounded-md bg-muted/60" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted/60" />
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      ) : null}

      {code ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              aria-label="Your referral link"
              className="h-9 flex-1 truncate rounded-md border border-input bg-muted/50 px-2 text-xs"
            />
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span title="Joined with your link, analysis not finished yet">Pending: {referrals.filter((r) => r.status === "pending").length}</span>
            <span title="Finished their first analysis — credits granted">Rewarded: {referrals.filter((r) => r.status === "rewarded").length}</span>
          </div>
          {referrals.length > 0 ? (
            <ul className="space-y-1.5">
              {referrals.slice(0, 10).map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-md border border-border/60 px-2.5 py-1.5 text-xs">
                  <span className="text-muted-foreground">
                    <ClientTime iso={r.created_at} kind="day" />
                  </span>
                  <span className="font-medium">{statusLabel(r.status)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
