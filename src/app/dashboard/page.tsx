import Link from "next/link"
import { Plus, AlertTriangle, Clock, FileText, ArrowRight, AlertCircle, CheckCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { IconDeal, IconRiskFlag, IconSeverityHigh, IconSeverityMedium } from "@/components/icons"
import { ErrorPanel } from "@/components/ui/error-panel"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusBadge } from "@/components/ui/status-badge"

export const dynamic = "force-dynamic"

type PageProps = { searchParams: Promise<{ error?: string }> }

interface Audit {
  id: string
  title: string
  status: string
  overall_score: number | null
  risk_report: unknown
  structured_data: Record<string, unknown> | null
  created_at: string
  updated_at: string | null
}

interface RiskCategory {
  severity: "low" | "medium" | "high"
  score: number
  findings: { title: string; description: string }[]
}

interface RiskReport {
  overallScore: number
  riskLevel: string
  summary: string
  categories: Record<string, RiskCategory>
}

function getDocsGenerated(structured: Record<string, unknown> | null): boolean {
  const docs = (structured as Record<string, unknown> | null)?.generatedDocuments
  return Array.isArray(docs) && docs.length > 0
}

function getDocs(structured: Record<string, unknown> | null): { type: string; createdAt: string }[] {
  return (structured as Record<string, unknown> | null)?.generatedDocuments as { type: string; createdAt: string }[] ?? []
}

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

function getRiskLevel(report: unknown): "Low" | "Medium" | "High" | "Critical" | null {
  if (!report || typeof report !== "object") return null
  return (report as Record<string, unknown>).riskLevel as "Low" | "Medium" | "High" | "Critical" | null
}

function getRiskReport(report: unknown): RiskReport | null {
  if (!report || typeof report !== "object") return null
  return report as RiskReport
}

function formatDate(date: string): string {
  const d = new Date(date)
  const diff = daysSince(date)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

interface AttentionItem {
  id: string
  dealId: string
  label: string
  reason: string
  severity?: "Critical" | "High" | "Medium"
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const createError = sp.error === "create-failed"

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div />
  }

  const { data: audits } = await supabase
    .from("audits")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20)

  const allAudits = (audits ?? []) as Audit[]

  // Needs Your Attention: specific actionable items
  const attentionItems: AttentionItem[] = allAudits.flatMap((a) => {
    const items: AttentionItem[] = []
    const report = getRiskReport(a.risk_report)
    const level = getRiskLevel(a.risk_report)
    const docsExist = getDocsGenerated(a.structured_data)

    // Unresolved risk flags — analyzed with Medium/High/Critical, no documents yet
    if (a.status === "analyzed" && report && (level === "High" || level === "Critical" || level === "Medium") && !docsExist) {
      items.push({ id: `${a.id}-unresolved-flag`, dealId: a.id, label: a.title, reason: `${level} risk flags unresolved — generate protection documents`, severity: level })
    }

    // Analyzed without protection documents — proposals not sent
    if (a.status === "analyzed" && report && !docsExist) {
      items.push({ id: `${a.id}-no-docs`, dealId: a.id, label: a.title, reason: "Protection documents not generated" })
    }

    // Failed analysis
    if (a.status === "failed") {
      items.push({ id: `${a.id}-failed`, dealId: a.id, label: a.title, reason: "Analysis failed — retry" })
    }

    // Stale draft — no updates in 7+ days
    if (a.status === "draft" && daysSince(a.updated_at ?? a.created_at) >= 7) {
      items.push({ id: `${a.id}-stale`, dealId: a.id, label: a.title, reason: "Draft not updated in 7+ days" })
    }

    return items
  })

  // Risk-flagged analyzed deals not already covered above (documents exist,
  // but flags remain): one informational row per deal, no duplication.
  const flaggedIds = new Set(
    attentionItems.filter((i) => i.severity).map((i) => i.dealId)
  )
  const riskAlerts = allAudits
    .filter((a) => a.status === "analyzed" && a.risk_report !== null && !flaggedIds.has(a.id))
    .map((a) => ({ audit: a, report: getRiskReport(a.risk_report) }))
    .filter((r): r is { audit: Audit; report: RiskReport } => r.report !== null)
    .filter((r) => r.report.riskLevel === "High" || r.report.riskLevel === "Critical" || r.report.riskLevel === "Medium")
    .slice(0, 5)

  const inProgress = allAudits.filter((a) =>
    ["draft", "processing"].includes(a.status)
  )

  const totalAudits = allAudits.length

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-6xl mx-auto">
      {createError && (
        <div className="mb-6">
          <ErrorPanel
            title="We couldn't create your deal."
            body="Your input is safe. Please try again — if this keeps happening, contact support."
            chargeNote="Nothing was charged for this attempt."
            retryLabel="Back to new deal"
            retryHref="/audit/new"
          />
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-7">

        {/* Left column — urgent content */}
        <div className="space-y-6 min-w-0">
          <section>
            <SectionTitle icon={AlertTriangle} title="Needs Your Attention" />
            {attentionItems.length > 0 ? (
              <div className="space-y-2">
                {attentionItems.slice(0, 5).map((item) => (
                  <AttentionCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-surface">
                <CheckCircle className="h-4 w-4 text-success shrink-0" />
                <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
              </div>
            )}
          </section>

          {riskAlerts.length > 0 && (
            <section>
              <SectionTitle icon={IconRiskFlag} title="Risk Alerts" />
              <div className="space-y-2">
                {riskAlerts.map(({ audit: a, report }) => (
                  <RiskAlertCard key={a.id} audit={a} report={report} />
                ))}
              </div>
            </section>
          )}

          {inProgress.length > 0 && (
            <section>
              <SectionTitle icon={Clock} title="In Progress" />
              <div className="space-y-1">
                {inProgress.slice(0, 5).map((a) => (
                  <ProgressRow key={a.id} audit={a} />
                ))}
              </div>
            </section>
          )}

          {totalAudits === 0 && (
            <EmptyState
              icon={IconDeal}
              title="No deals yet"
              body="Paste a client brief, even a messy one — Dealenz will flag what's risky before you reply."
              actionLabel="New Deal"
              actionHref="/audit/new"
            />
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4 mt-6 lg:mt-0">
          <section className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Start
            </h3>
            <div className="mt-3 space-y-2">
              <Link
                href="/audit/new"
                className="flex items-center justify-between rounded-lg bg-primary p-3 sm:p-4 text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <span className="text-sm font-medium">New Deal</span>
                <Plus className="h-4 w-4" />
              </Link>
            </div>
          </section>

          {/* Recent Activity with event detail */}
          {allAudits.length > 0 && (
            <section className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Recent Activity
              </h3>
              <div className="mt-3 space-y-1">
                {buildActivityItems(allAudits).slice(0, 5).map((item) => (
                  <Link
                    key={item.id}
                    href={`/audit/${item.dealId}`}
                    className="flex items-center gap-3 py-1.5 text-sm group"
                  >
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      item.type === "risk_flagged" && "bg-risk-high",
                      item.type === "deal_created" && "bg-muted-foreground/20",
                      item.type === "documents_generated" && "bg-info",
                      item.type === "analyzed" && "bg-risk-medium",
                      item.type === "failed" && "bg-destructive",
                    )} />
                    <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors">
                      {item.label}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground/60 shrink-0" data-numeric>
                      {formatDate(item.timestamp)}
                    </span>
                  </Link>
                ))}
              </div>
              {allAudits.length > 5 && (
                <Link
                  href="/dashboard/activity"
                  className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-2 border-t border-border/60"
                >
                  View all activity
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </section>
          )}
        </div>

      </div>
    </div>
  )
}

interface ActivityItem {
  id: string
  dealId: string
  type: "deal_created" | "analyzed" | "risk_flagged" | "documents_generated" | "failed"
  label: string
  timestamp: string
}

function buildActivityItems(audits: Audit[]): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const a of audits) {
    const docs = getDocs(a.structured_data)
    const report = getRiskReport(a.risk_report)
    const level = getRiskLevel(a.risk_report)

    if (a.status === "failed") {
      items.push({ id: `${a.id}-failed`, dealId: a.id, type: "failed", label: `${a.title} — analysis failed`, timestamp: a.updated_at ?? a.created_at })
    }

    if (a.status === "analyzed" && report) {
      items.push({ id: `${a.id}-analyzed`, dealId: a.id, type: "analyzed", label: `${a.title} — risk analysis complete`, timestamp: a.updated_at ?? a.created_at })
      if (level === "High" || level === "Critical" || level === "Medium") {
        items.push({ id: `${a.id}-flag`, dealId: a.id, type: "risk_flagged", label: `${a.title} — ${level} risk flag detected`, timestamp: a.updated_at ?? a.created_at })
      }
    }

    if (docs.length > 0) {
      items.push({ id: `${a.id}-docs`, dealId: a.id, type: "documents_generated", label: `${a.title} — protection package generated`, timestamp: docs[docs.length - 1].createdAt })
    }

    items.push({ id: `${a.id}-created`, dealId: a.id, type: "deal_created", label: `${a.title} — deal created`, timestamp: a.created_at })
  }
  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

/* Shared sub-components */

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
    </div>
  )
}

function AttentionCard({ item }: { item: AttentionItem }) {
  return (
    <Link
      href={`/audit/${item.dealId}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 hover:bg-muted/50 transition-colors group shadow-surface"
    >
      <div className="flex items-center gap-3 min-w-0">
        <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{item.label}</p>
          <p className="text-xs text-muted-foreground">{item.reason}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.severity && (
          <StatusBadge tone={item.severity === "Medium" ? "warning" : "error"}>
            {item.severity}
          </StatusBadge>
        )}
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
      </div>
    </Link>
  )
}

function RiskAlertCard({ audit, report }: { audit: Audit; report: RiskReport }) {
  const level = report.riskLevel

  // Find first non-low category for one-line reason
  const topCategory = Object.entries(report.categories).find(([, c]) => c.severity !== "low")
  const reason = topCategory
    ? topCategory[1].findings[0]?.title ?? topCategory[0].replace(/([A-Z])/g, " $1").trim()
    : report.summary.slice(0, 80)

  return (
    <Link
      href={`/audit/${audit.id}`}
      className={cn(
        "flex items-start justify-between rounded-xl border border-border/60 p-3.5 hover:bg-muted/50 transition-colors group border-l-4 shadow-sm gap-3",
        level === "Critical" && "border-l-risk-critical bg-risk-critical/5",
        level === "High" && "border-l-risk-high bg-risk-high/5",
        level === "Medium" && "border-l-risk-medium bg-risk-medium/5",
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className={cn(
          "mt-0.5 shrink-0",
          level === "Critical" && "text-risk-critical",
          level === "High" && "text-risk-high",
          level === "Medium" && "text-risk-medium",
        )}>
          {level === "Critical" || level === "High" ? (
            <IconSeverityHigh className="h-4 w-4" />
          ) : (
            <IconSeverityMedium className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{audit.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{reason}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <StatusBadge tone={level === "Medium" ? "warning" : "error"}>{level}</StatusBadge>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
      </div>
    </Link>
  )
}

function ProgressRow({ audit }: { audit: Audit }) {
  const stageLabels: Record<string, string> = {
    draft: "Intake",
    processing: "Analyzing",
  }

  return (
    <Link
      href={`/audit/${audit.id}`}
      className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm truncate">{audit.title}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground bg-muted/80 rounded-full px-2 py-0.5 font-medium">
          {stageLabels[audit.status] ?? audit.status.replace("_", " ")}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
      </div>
    </Link>
  )
}
