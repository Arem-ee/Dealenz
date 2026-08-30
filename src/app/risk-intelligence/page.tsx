import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, Shield, BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { IconRiskFlag } from "@/components/icons"

export const dynamic = "force-dynamic"

interface Audit {
  id: string
  title: string
  overall_score: number | null
  risk_report: unknown
  created_at: string
}

function getRiskLevel(report: unknown): string | null {
  if (!report || typeof report !== "object") return null
  return (report as Record<string, unknown>).riskLevel as string | null
}

const riskLibrary = [
  {
    category: "Scope",
    patterns: [
      { title: "Unlimited Revisions", severity: "high", description: "No cap on revision cycles can lead to infinite scope creep. Mitigation: Define revision rounds with clear acceptance criteria." },
      { title: "Vague Deliverables", severity: "high", description: "Undefined deliverables make it impossible to determine when work is complete. Mitigation: List specific, measurable outputs." },
      { title: "Open-ended Timeline", severity: "medium", description: "\"ASAP\" or no timeline means expectations can shift. Mitigation: Set firm dates with buffer for revisions." },
    ],
  },
  {
    category: "Payment",
    patterns: [
      { title: "Net-90 Terms", severity: "high", description: "Long payment terms strain cash flow. Mitigation: Request net-15/30 or milestone-based payments." },
      { title: "No Deposit", severity: "medium", description: "Starting work without upfront payment increases risk. Mitigation: Require 25-50% deposit." },
      { title: "Vague Budget", severity: "medium", description: "No stated budget means the client may not have allocated funds. Mitigation: Establish a range before scoping." },
    ],
  },
  {
    category: "Legal",
    patterns: [
      { title: "Work-for-Hire IP", severity: "high", description: "Transfers all ownership including future work. Mitigation: Limit to deliverable-specific license." },
      { title: "No Termination Clause", severity: "medium", description: "No exit terms for either party. Mitigation: Include 14-day termination notice." },
      { title: "Indemnification", severity: "medium", description: "Broad indemnity clauses can hold you liable for client actions. Mitigation: Cap at fees paid." },
    ],
  },
]

export default async function RiskIntelligencePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  if (!user.email_confirmed_at) {
    redirect("/dashboard")
  }

  const { data: audits } = await supabase
    .from("audits")
    .select("id, title, overall_score, risk_report, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  const all = (audits ?? []) as Audit[]
  const withFlags = all.filter(a => a.risk_report !== null)

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-6xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold">Risk Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track risk patterns across your deals and learn what to watch for
        </p>
      </div>

      {/* Your Risk Activity */}
      <section className="mt-7">
        <div className="flex items-center gap-2 mb-3">
          <IconRiskFlag className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Risk Activity</h2>
        </div>

        {withFlags.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center rounded-xl border border-dashed border-border/60">
            <Shield className="h-8 w-8 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium">No flags yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Once you run a risk analysis, flagged deals will appear here.
                Browse the Risk Library below to learn what to watch for in the meantime.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {withFlags.slice(0, 10).map((a) => {
              const level = getRiskLevel(a.risk_report)
              return (
                <Link
                  key={a.id}
                  href={`/audit/${a.id}`}
                  className={cn(
                    "flex items-center justify-between rounded-xl border border-border/60 bg-card p-3.5 hover:bg-muted/50 transition-colors group shadow-sm border-l-4",
                    level === "High" && "border-l-risk-high",
                    level === "Medium" && "border-l-risk-medium",
                    (!level || level === "Low") && "border-l-risk-low"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <IconRiskFlag className={cn(
                      "h-4 w-4 shrink-0",
                      level === "High" ? "text-risk-high" : level === "Medium" ? "text-risk-medium" : "text-risk-low"
                    )} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Score <span className="tabular-nums" data-numeric>{a.overall_score ?? "—"}</span>/100
                        {level && <> — {level} Risk</>}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Risk Library */}
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk Library</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Common red-flag patterns with plain-language explanations and mitigation suggestions.
        </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {riskLibrary.map((group) => (
            <div key={group.category} className="space-y-3">
              <h3 className="text-sm font-semibold">{group.category}</h3>
              <div className="space-y-2">
                {group.patterns.map((p) => (
                  <div
                    key={p.title}
                    className="rounded-xl border border-border/60 bg-card p-3.5 shadow-sm"
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        "mt-0.5 h-2 w-2 rounded-full shrink-0",
                        p.severity === "high" ? "bg-risk-high" : "bg-risk-medium"
                      )} />
                      <div>
                        <p className="text-sm font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {p.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
