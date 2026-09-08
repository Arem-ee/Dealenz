import { CreditCard, Shield } from "lucide-react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { ReferralSection } from "@/components/referral-section"

export const dynamic = "force-dynamic"

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  if (!user.email_confirmed_at) {
    redirect("/dashboard")
  }

  let usedAnalyses = 0
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
  }

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-3xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your subscription and usage
        </p>
      </div>

      <div className="mt-7 space-y-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Free Plan</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  5 analyses per day, unlimited deals, document generation
                </p>
              </div>
            </div>
            <span className="rounded-md bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
              Active
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-border/60">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">AI analyses used today</span>
              <span className={cn(
                "font-medium tabular-nums",
                usedAnalyses >= 5 ? "text-risk-high" : "text-foreground"
              )} data-numeric>{usedAnalyses}/5</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Ask credits</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deal analysis is free (5 per day, rate-limited). Ask conversations use credits: brief 1, standard 3, extended 8. Greetings cost 0.
              </p>
            </div>
          </div>
        </div>

        <ReferralSection />

        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">No payment information required</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Plans and pricing are coming soon. You&apos;ll be notified when paid tiers are available.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
