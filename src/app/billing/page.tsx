import { Shield } from "lucide-react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { ReferralSection } from "@/components/referral-section"
import { PurchaseSection } from "@/components/billing/purchase-section"
import { formatPrice, type Currency } from "@/lib/billing/catalog"
import { rateLimitFor } from "@/lib/rate-limit"
import {
  CREDIT_PRICE_BRIEF,
  CREDIT_PRICE_STANDARD,
  CREDIT_PRICE_EXTENDED,
  DOCUMENT_CREDIT_COSTS,
  UPLOAD_CREDITS,
  SIGNATURE_SEND_CREDITS,
  LAWYER_REQUEST_CREDITS,
} from "@/lib/credits/pricing"

interface PurchaseRow {
  id: string
  package_id: string
  credits: number
  amount_minor: number
  currency: string
  status: string
  created_at: string
}

export const PURCHASE_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  succeeded: { label: "Credited", tone: "text-success" },
  pending: { label: "Processing — credits appear after verified settlement", tone: "text-warning-foreground" },
  failed: { label: "Failed — no credits charged", tone: "text-destructive" },
  canceled: { label: "Canceled — no credits charged", tone: "text-muted-foreground" },
}

export const dynamic = "force-dynamic"

interface BillingSearchParams {
  checkout?: string
}

/**
 * Checkout-return messaging. Query params are untrusted navigation hints:
 * they select at most a neutral notice and can never confer payment success,
 * mutate balances, or mark purchases. Unknown values render nothing.
 */
export function checkoutReturnNotice(
  kind: string | undefined
): { title: string; body: string } | null {
  if (kind === "cancel") {
    return {
      title: "Checkout cancelled",
      body: "No charge was made. Your balance is unchanged — buy credits below whenever you need them.",
    }
  }
  if (kind === "success") {
    return {
      title: "Back from checkout",
      body: "Returning here does not mean payment succeeded. Credits appear below in purchase history once settlement is verified — this usually takes under a minute.",
    }
  }
  return null
}

// A full freelance loop with the analysis on the free daily allowance:
// proposal + signature send. The anchor every other number on this page
// hangs off.
const FULL_DEAL_CREDITS = DOCUMENT_CREDIT_COSTS.proposal + SIGNATURE_SEND_CREDITS

const PRICE_ROWS: Array<[string, number]> = [
  ["Ask, brief", CREDIT_PRICE_BRIEF],
  ["Ask, standard", CREDIT_PRICE_STANDARD],
  ["Ask, extended", CREDIT_PRICE_EXTENDED],
  ["Proposal", DOCUMENT_CREDIT_COSTS.proposal],
  ["Scope of work", DOCUMENT_CREDIT_COSTS.sow],
  ["Contract", DOCUMENT_CREDIT_COSTS.contract],
  ["Checklist", DOCUMENT_CREDIT_COSTS.checklist],
  ["Document upload", UPLOAD_CREDITS],
  ["Signature send", SIGNATURE_SEND_CREDITS],
  ["Lawyer request — coming soon", LAWYER_REQUEST_CREDITS],
]

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<BillingSearchParams>
}) {
  const notice = checkoutReturnNotice((await searchParams)?.checkout)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  if (!user.email_confirmed_at) {
    redirect("/dashboard")
  }

  const dailyLimit = rateLimitFor("analyzeDeal")
  let usedAnalyses = 0
  let creditBalance: number | null = null
  let purchases: PurchaseRow[] = []
  if (user) {
    const today = new Date().toISOString().split("T")[0]
    const { data: usage } = await supabase
      .from("usage_tracking")
      .select("count")
      .eq("user_id", user.id)
      .eq("action_type", "analyzeDeal")
      .gte("date", today)
      .maybeSingle()
    if (usage) usedAnalyses = (usage as { count: number }).count ?? 0
    // Purchase history is a read-only view: authoritative state lives in
    // credit_purchases (server/webhook path), never in browser navigation.
    const { data: purchaseRows } = await supabase
      .from("credit_purchases")
      .select("id, package_id, credits, amount_minor, currency, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
    purchases = ((purchaseRows ?? []) as PurchaseRow[]).filter((p) => typeof p.id === "string")
    const { data: balData } = await supabase.rpc("credit_balance")
    if (Array.isArray(balData) && balData[0] && typeof (balData[0] as Record<string, unknown>).balance === "number") {
      creditBalance = Math.floor((balData[0] as { balance: number }).balance)
    } else if (balData && typeof (balData as Record<string, unknown>).balance === "number") {
      creditBalance = Math.floor((balData as { balance: number }).balance)
    }
  }

  const dealsCovered = creditBalance !== null ? Math.floor(creditBalance / FULL_DEAL_CREDITS) : null
  const freeUsedUp = usedAnalyses >= dailyLimit

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-3xl mx-auto">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-burgundy">
        Billing · No subscriptions
      </p>
      <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">
        One full deal, about {FULL_DEAL_CREDITS} credits.
      </h1>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Analysis is free every day. Credits pay for outcomes — proposals, documents,
        signature sends — never for a favorable answer.
      </p>

      {notice && (
        <div role="status" className="mt-4 rounded-xl border border-border bg-card p-4 text-sm shadow-surface">
          <p className="font-medium">{notice.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{notice.body}</p>
        </div>
      )}

      {/* Balance hero: what you hold, what it buys, one action. */}
      <div className="mt-5 rounded-3xl bg-burgundy p-6 text-white shadow-sm sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
              Your balance
            </p>
            <p className="mt-1 text-[44px] font-bold leading-none tracking-tight tabular-nums" data-numeric>
              {creditBalance !== null ? creditBalance : "—"}
              <span className="ml-2 align-middle text-[13px] font-normal text-white/60">credits</span>
            </p>
            <p className="mt-2 text-[13px] text-white/75">
              {dealsCovered !== null
                ? dealsCovered > 0
                  ? `Covers about ${dealsCovered} full deal${dealsCovered === 1 ? "" : "s"} from proposal to signature.`
                  : "Not enough for a full deal yet — top up or earn free credits below."
                : "Balance unavailable right now — the packages below still work."}
            </p>
          </div>
          <a
            href="#buy-credits"
            className="inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-semibold text-burgundy transition-colors hover:bg-white/90"
          >
            Buy credits
          </a>
        </div>
      </div>

      {/* Free daily allowance: one line, one bar. */}
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
        <Shield className="h-4 w-4 shrink-0 text-burgundy" />
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Free analyses today</span>{" "}
          <span className="tabular-nums" data-numeric>{usedAnalyses}/{dailyLimit}</span>
          {freeUsedUp ? " — daily allowance used, credits cover the rest." : " — resets tomorrow."}
        </p>
        <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-black/[0.07]" aria-hidden>
          <div
            className={cn("h-full rounded-full", freeUsedUp ? "bg-burgundy" : "bg-black/30")}
            style={{ width: `${Math.min(100, Math.round((usedAnalyses / Math.max(1, dailyLimit)) * 100))}%` }}
          />
        </div>
      </div>

      <div className="mt-7 space-y-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm" id="buy-credits">
          <PurchaseSection />
        </div>

        <ReferralSection />

        <details className="group rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium">
            Full price list
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Every credit price, in one place. A full deal runs about {FULL_DEAL_CREDITS} credits.
            </span>
          </summary>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border/60 pt-4 text-xs sm:grid-cols-3">
            {PRICE_ROWS.map(([label, cost]) => (
              <div key={label} className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular-nums" data-numeric>{cost}</dd>
              </div>
            ))}
          </dl>
        </details>

        <details className="group rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium">
            Purchase history{purchases.length > 0 ? ` (${purchases.length})` : ""}
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Credits appear here once settlement is verified — returning from checkout alone means nothing.
            </span>
          </summary>
          {purchases.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No purchases yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 border-t border-border/60 pt-3">
              {purchases.map((p) => {
                const state = PURCHASE_STATUS_LABEL[p.status] ?? { label: p.status, tone: "text-muted-foreground" }
                const price =
                  p.currency === "USD" || p.currency === "GBP" || p.currency === "EUR"
                    ? formatPrice(p.amount_minor, p.currency as Currency)
                    : `${p.amount_minor} ${p.currency}`
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium capitalize">{p.package_id} · {p.credits} credits · {price}</span>
                    <span className={cn("shrink-0", state.tone)}>{state.label}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </details>
      </div>
    </div>
  )
}
