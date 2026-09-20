import { CreditCard, Shield } from "lucide-react"
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

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-3xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your credits and usage — no subscriptions
        </p>
      </div>

      {notice && (
        <div role="status" className="mt-4 rounded-xl border border-border bg-card p-4 text-sm shadow-surface">
          <p className="font-medium">{notice.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{notice.body}</p>
        </div>
      )}

      <div className="mt-7 space-y-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Free usage</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rateLimitFor("analyzeDeal")} deal analyses per day. No subscriptions — extra AI work uses purchased credits below.
                </p>
              </div>
            </div>
            <span className="rounded-md bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
              Free
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-border/60">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Free AI analyses used today</span>
                <span className={cn(
                  "font-medium tabular-nums",
                  usedAnalyses >= rateLimitFor("analyzeDeal") ? "text-risk-high" : "text-foreground"
                )} data-numeric>{usedAnalyses}/{rateLimitFor("analyzeDeal")}</span>
              </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">What credits pay for {creditBalance !== null ? `— ${creditBalance} available` : ""}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Credits pay for deal outcomes across all deal types — never for a favorable answer. Greetings cost 0, and the free daily analyses above never consume credits.
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border/60 pt-4 text-xs sm:grid-cols-3">
            <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Ask, brief</dt><dd className="font-medium tabular-nums" data-numeric>{CREDIT_PRICE_BRIEF}</dd></div>
            <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Ask, standard</dt><dd className="font-medium tabular-nums" data-numeric>{CREDIT_PRICE_STANDARD}</dd></div>
            <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Ask, extended</dt><dd className="font-medium tabular-nums" data-numeric>{CREDIT_PRICE_EXTENDED}</dd></div>
            <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Proposal</dt><dd className="font-medium tabular-nums" data-numeric>{DOCUMENT_CREDIT_COSTS.proposal}</dd></div>
            <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Scope of work</dt><dd className="font-medium tabular-nums" data-numeric>{DOCUMENT_CREDIT_COSTS.sow}</dd></div>
            <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Contract</dt><dd className="font-medium tabular-nums" data-numeric>{DOCUMENT_CREDIT_COSTS.contract}</dd></div>
            <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Checklist</dt><dd className="font-medium tabular-nums" data-numeric>{DOCUMENT_CREDIT_COSTS.checklist}</dd></div>
            <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Document upload</dt><dd className="font-medium tabular-nums" data-numeric>{UPLOAD_CREDITS}</dd></div>
            <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Signature send</dt><dd className="font-medium tabular-nums" data-numeric>{SIGNATURE_SEND_CREDITS}</dd></div>
            <div className="flex items-baseline justify-between gap-2"><dt className="text-muted-foreground">Lawyer request</dt><dd className="font-medium tabular-nums" data-numeric>{LAWYER_REQUEST_CREDITS}</dd></div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            A typical freelance loop — analysis on the free daily allowance, proposal ({DOCUMENT_CREDIT_COSTS.proposal}), signature send ({SIGNATURE_SEND_CREDITS}) — runs about {DOCUMENT_CREDIT_COSTS.proposal + SIGNATURE_SEND_CREDITS} credits
            when the analysis itself is free.
          </p>
        </div>

        <ReferralSection />

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm" id="buy-credits">
          <PurchaseSection />
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Payment processing</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                After checkout, return here — your purchased credits appear after verified webhook settlement (idempotent). Redirect alone does not mean payment succeeded.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <p className="text-sm font-medium">Purchase history</p>
          {purchases.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              No purchases yet. Completed purchases appear here once settlement is verified.{" "}
              <a href="#buy-credits" className="font-medium text-primary hover:underline">
                Buy credits above
              </a>
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
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
        </div>
      </div>
    </div>
  )
}
