"use client"

import {
  CheckCircle2,
  Shield,
  ShieldAlert,
  ShieldMinus,
  Lightbulb,
  Scale,
  Gavel,
  Timer,
  DollarSign,
  MessageSquare,
  RefreshCw,
  UserX,
} from "lucide-react"
import type { RiskReport as RiskReportType, RiskCategory, RiskFinding } from "@/lib/risk/engine"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LegalDisclaimer } from "@/components/legal-disclaimer"
import { cn } from "@/lib/utils"

interface RiskReportProps {
  report: RiskReportType
}

const categoryConfig: Record<string, { icon: React.ElementType; label: string }> = {
  scopeRisk: { icon: Shield, label: "Scope Risk" },
  paymentRisk: { icon: DollarSign, label: "Payment Risk" },
  timelineRisk: { icon: Timer, label: "Timeline Risk" },
  communicationRisk: { icon: MessageSquare, label: "Communication Risk" },
  revisionRisk: { icon: RefreshCw, label: "Revision Risk" },
  legalRisk: { icon: Gavel, label: "Legal Risk" },
  ipRisk: { icon: Scale, label: "IP Risk" },
  clientBehaviorRisk: { icon: UserX, label: "Client Behavior Risk" },
}

function ScoreGauge({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const color =
    score >= 80 ? "stroke-green-500" : score >= 50 ? "stroke-amber-500" : "stroke-red-500"
  const r = size === "lg" ? 54 : 36
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  return (
    <div className={cn("relative inline-flex items-center justify-center", size === "lg" ? "h-32 w-32" : "h-20 w-20")}>
      <svg className="absolute inset-0 -rotate-90" width="100%" height="100%" viewBox={`0 0 ${(r + 10) * 2} ${(r + 10) * 2}`}>
        <circle cx={r + 10} cy={r + 10} r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted-foreground/20" />
        <circle
          cx={r + 10}
          cy={r + 10}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className={color + " transition-all duration-700"}
        />
      </svg>
      <span className={cn("font-bold", size === "lg" ? "text-3xl" : "text-lg")}>{score}</span>
    </div>
  )
}

function RiskBadge({ level }: { level: "Low" | "Medium" | "High" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium",
        level === "Low" && "bg-green-100 text-green-700",
        level === "Medium" && "bg-amber-100 text-amber-700",
        level === "High" && "bg-red-100 text-red-700"
      )}
    >
      {level === "Low" && <CheckCircle2 className="h-4 w-4" />}
      {level === "Medium" && <ShieldMinus className="h-4 w-4" />}
      {level === "High" && <ShieldAlert className="h-4 w-4" />}
      {level} Risk
    </span>
  )
}

function CategoryCard({ category, config }: { category: RiskCategory; config: { icon: React.ElementType; label: string } }) {
  const Icon = config.icon
  const borderColor =
    category.severity === "low"
      ? "border-l-green-500"
      : category.severity === "medium"
      ? "border-l-amber-500"
      : "border-l-red-500"

  return (
    <Card className={cn("border-l-4", borderColor)}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">{config.label}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <ScoreGauge score={category.score} size="sm" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {category.findings.length > 0 ? (
          category.findings.map((finding, i) => (
            <FindingItem key={i} finding={finding} />
          ))
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            No significant risks detected
          </div>
        )}
        {category.mitigations && (
          <div className="flex items-start gap-2 rounded-md bg-primary/5 p-3 text-xs">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{category.mitigations}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FindingItem({ finding }: { finding: RiskFinding }) {
  return (
    <div className="space-y-1 rounded-md border bg-muted/30 p-2.5">
      <p className="text-xs font-medium">{finding.title}</p>
      <p className="text-xs text-muted-foreground">{finding.description}</p>
      {finding.evidence && (
        <p className="text-xs italic text-muted-foreground/70">
          Evidence: &ldquo;{finding.evidence}&rdquo;
        </p>
      )}
    </div>
  )
}

export function RiskReportView({ report }: RiskReportProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center">
        <div className="flex items-center gap-4">
          <ScoreGauge score={report.overallScore} size="lg" />
          <div className="text-left">
            <p className="text-sm text-muted-foreground">Deal Health Score</p>
            <RiskBadge level={report.riskLevel} />
          </div>
        </div>
        <p className="max-w-lg text-sm text-muted-foreground">{report.summary}</p>
        {report.recommendations.length > 0 && (
          <div className="w-full text-left mt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recommendations</p>
            <ul className="space-y-1">
              {report.recommendations.map((r, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.entries(categoryConfig) as [string, { icon: React.ElementType; label: string }][]).map(
          ([key, config]) => (
            <CategoryCard
              key={key}
              category={report.categories[key as keyof typeof report.categories]}
              config={config}
            />
          )
        )}
      </div>

      <LegalDisclaimer />
    </div>
  )
}
