import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, ChevronRight, Building, Shield } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { IconDeal } from "@/components/icons"

export const dynamic = "force-dynamic"

interface Audit {
  id: string
  title: string
  status: string
  overall_score: number | null
  risk_report: unknown
  created_at: string
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  if (!user.email_confirmed_at) {
    redirect("/dashboard")
  }

  const { data: clientProfile } = await supabase
    .from("client_profiles")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  const clientName = clientProfile?.name ?? id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  const { data: audits } = await supabase
    .from("audits")
    .select("id, title, status, overall_score, risk_report, created_at")
    .eq("client_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  const all = (audits ?? []) as Audit[]
  const clientDeals = all

  const flaggedDeals = clientDeals.filter((a) => a.risk_report !== null)

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-5xl mx-auto">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ChevronRight className="h-3 w-3 rotate-180" />
        All Clients
      </Link>

      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Building className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">{clientName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clientDeals.length} deal{clientDeals.length !== 1 ? "s" : ""}
            {flaggedDeals.length > 0 && ` · ${flaggedDeals.length} flagged`}
          </p>
        </div>
      </div>

      {/* Trust indicators */}
      {clientDeals.length === 0 && (
        <div className="mt-8 flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">New client — no history yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              General risk patterns for their type/industry will be used during analysis
              until deal history accumulates.
            </p>
          </div>
        </div>
      )}

      {/* Deal history */}
      <div className="mt-8">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Deal History</h2>
        {clientDeals.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center rounded-xl border border-dashed border-border/60">
            <IconDeal className="h-8 w-8 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium">No deals yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Deals with this client will appear here once created.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {clientDeals.map((a) => (
              <Link
                key={a.id}
                href={`/audit/${a.id}`}
                className={cn(
                  "flex items-center justify-between rounded-xl border border-border/60 bg-card p-3.5 hover:bg-muted/50 transition-colors group shadow-sm border-l-4",
                  a.risk_report !== null && typeof a.risk_report === "object"
                    ? ((a.risk_report as Record<string, unknown>).riskLevel === "High" || (a.risk_report as Record<string, unknown>).riskLevel === "Critical")
                      ? "border-l-risk-high"
                      : (a.risk_report as Record<string, unknown>).riskLevel === "Medium"
                        ? "border-l-risk-medium"
                        : "border-l-risk-low"
                    : "border-l-transparent"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <IconDeal className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(a.created_at).toLocaleDateString()}</span>
                      {a.overall_score !== null && (
                        <>
                          <span className="opacity-30">·</span>
                          <span>
                            Score <span className="tabular-nums" data-numeric>{a.overall_score}</span>/100
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
