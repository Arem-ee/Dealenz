import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { IconPipeline, IconDeal } from "@/components/icons"
import { EmptyState } from "@/components/ui/empty-state"

export const dynamic = "force-dynamic"

interface Audit {
  id: string
  title: string
  status: string
  overall_score: number | null
  risk_report: unknown
  created_at: string
}

const stageOrder: Record<string, number> = {
  draft: 0,
  processing: 1,
  analyzed: 2,
  failed: 3,
}

const stageLabels: Record<string, string> = {
  draft: "Intake",
  processing: "Analyzing",
  analyzed: "Completed",
  failed: "Failed",
}

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ flagged?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  if (!user.email_confirmed_at) {
    redirect("/dashboard")
  }

  const sp = await searchParams
  const flaggedOnly = sp.flagged === "1"

  const { data: audits } = await supabase
    .from("audits")
    .select("id, title, status, overall_score, risk_report, created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50)

  const all = (audits ?? []) as Audit[]
  const visible = flaggedOnly ? all.filter((a) => a.risk_report !== null) : all
  const grouped = visible.reduce<Record<string, Audit[]>>((acc, a) => {
    const group = stageLabels[a.status] ?? a.status
    if (!acc[group]) acc[group] = []
    acc[group].push(a)
    return acc
  }, {})
  const sortedGroups = Object.entries(grouped).sort(
    ([a], [b]) => (stageOrder[a.toLowerCase()] ?? 99) - (stageOrder[b.toLowerCase()] ?? 99)
  )

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Deals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {visible.length} deal{visible.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/audit/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconDeal className="h-4 w-4" />
          New Deal
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/deals"
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${flaggedOnly ? "border-border bg-card text-muted-foreground hover:text-foreground" : "bg-primary text-primary-foreground border-primary"}`}
        >
          All deals
        </Link>
        <Link
          href="/deals?flagged=1"
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${flaggedOnly ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
        >
          Flagged
        </Link>
      </div>

      {visible.length === 0 ? (
        flaggedOnly ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center rounded-xl border border-dashed border-border/60">
            <p className="text-sm font-medium">No flagged deals</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Once you run a risk analysis, flagged deals will appear here.
            </p>
          </div>
        ) : (
        <EmptyState
          icon={IconPipeline}
          title="Your first deal starts here"
          body="Paste a client brief, even a messy one — Dealenz will flag what's risky before you reply."
          actionLabel="New Deal"
          actionHref="/audit/new"
        />
        )
      ) : (
        <div className="space-y-8">
          {sortedGroups.map(([group, items]) => (
            <section key={group}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {group}
                <span className="ml-2 font-normal text-muted-foreground/60">({items.length})</span>
              </h2>
              <div className="space-y-2">
                {items.map((a) => (
                  <Link
                    key={a.id}
                    href={`/audit/${a.id}`}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3.5 hover:bg-muted/50 transition-colors group shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString()}
                          {a.overall_score !== null && (
                            <> — Risk score <span className="tabular-nums" data-numeric>{a.overall_score}</span>/100</>
                          )}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
