"use client"

import { CheckCircle2, ShieldAlert, ShieldMinus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LegalDisclaimer } from "@/components/legal-disclaimer"
import { cn } from "@/lib/utils"
import type { GenericRiskReport } from "@/lib/ai/risk-analysis"
import { Lightbulb } from "lucide-react"

interface GenericRiskReportProps {
  report: GenericRiskReport
  degraded?: boolean
}

function ScoreGauge({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const color = score >= 80 ? "stroke-green-500" : score >= 50 ? "stroke-amber-500" : "stroke-red-500"
  const r = size === "lg" ? 54 : 36
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <div className={cn("relative inline-flex items-center justify-center", size === "lg" ? "h-32 w-32" : "h-20 w-20")}>
      <svg className="absolute inset-0 -rotate-90" width="100%" height="100%" viewBox={`0 0 ${(r + 10) * 2} ${(r + 10) * 2}`}>
        <circle cx={r + 10} cy={r + 10} r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted-foreground/20" />
        <circle cx={r + 10} cy={r + 10} r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} className={color + " transition-all duration-700"} />
      </svg>
      <span className={cn("font-bold", size === "lg" ? "text-3xl" : "text-lg")}>{score}</span>
    </div>
  )
}

function RiskBadge({ level }: { level: "Low" | "Medium" | "High" }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium", level === "Low" && "bg-risk-low/15 text-risk-low-foreground", level === "Medium" && "bg-risk-medium/15 text-risk-medium", level === "High" && "bg-risk-high/10 text-risk-high")}>
      {level === "Low" && <CheckCircle2 className="h-4 w-4" />}
      {level === "Medium" && <ShieldMinus className="h-4 w-4" />}
      {level === "High" && <ShieldAlert className="h-4 w-4" />}
      {level} Risk
    </span>
  )
}

export function GenericRiskReportView({ report, degraded }: GenericRiskReportProps) {
  const entries = Object.entries(report.categories)
  return (
    <div className="space-y-6">
      {degraded && (
        <div className="rounded-lg border border-warning/30 bg-warning/[0.07] p-3 text-sm text-warning-foreground">This risk analysis is incomplete and was produced from a degraded path. Review the agreement manually before signing.</div>
      )}
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center">
        <div className="flex items-center gap-4">
          <ScoreGauge score={report.overallScore} size="lg" />
          <div className="text-left">
            <p className="text-sm text-muted-foreground">Deal Health Score</p>
            <RiskBadge level={report.riskLevel} />
          </div>
        </div>
        <p className="max-w-lg text-sm text-muted-foreground">{report.summary}</p>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No distinct risk themes were flagged for this agreement.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map(([key, cat]) => (
            <Card key={key} className={cn("border-l-4", cat.severity === "low" ? "border-l-risk-low" : cat.severity === "medium" ? "border-l-risk-medium" : "border-l-risk-high")}>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm capitalize">{key.replace(/[-_]/g, " ")}</CardTitle>
                <ScoreGauge score={cat.score} size="sm" />
              </CardHeader>
              <CardContent className="space-y-3">
                {cat.findings.length > 0 ? (
                  cat.findings.map((f, i) => (
                    <div key={i} className="space-y-1 rounded-md border bg-muted/30 p-2.5">
                      <p className="text-xs font-medium">{f.title}</p>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                      {f.evidence && <p className="text-xs italic text-muted-foreground/70">Suggestion: {f.evidence}</p>}
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    No significant risks detected
                  </div>
                )}
                {cat.mitigations && (
                  <div className="flex items-start gap-2 rounded-md bg-primary/5 p-3 text-xs">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{cat.mitigations}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {report.recommendations.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">What to ask before signing</h3>
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
      <LegalDisclaimer />
    </div>
  )
}
