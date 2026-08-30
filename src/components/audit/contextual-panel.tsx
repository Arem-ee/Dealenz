"use client"

import { Shield, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconRiskFlag, IconClient } from "@/components/icons"
import type { RiskReport } from "@/lib/risk/engine"
import type { GenericRiskReport } from "@/lib/ai/risk-analysis"

interface ContextualPanelProps {
  riskReport: RiskReport | GenericRiskReport | null
  overallScore: number | null
  riskLevel: string | null
  className?: string
}

const categoryLabels: Record<string, string> = {
  scopeRisk: "Scope Risk",
  paymentRisk: "Payment Risk",
  timelineRisk: "Timeline Risk",
  communicationRisk: "Communication Risk",
  revisionRisk: "Revision Risk",
  legalRisk: "Legal Risk",
  ipRisk: "IP Risk",
  clientBehaviorRisk: "Client Behavior Risk",
}

export function ContextualPanel({
  riskReport,
  overallScore,
  riskLevel,
  className,
}: ContextualPanelProps) {
  const hasData = riskReport !== null

  return (
    <div className={cn("space-y-4", className)}>
      {hasData && riskReport ? (
        <>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Deal Health
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold",
                riskLevel === "High" && "bg-risk-high/10 text-risk-high",
                riskLevel === "Medium" && "bg-risk-medium/10 text-risk-medium",
                (!riskLevel || riskLevel === "Low") && "bg-risk-low/10 text-risk-low"
              )}>
                {overallScore ?? "—"}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {riskLevel ?? "N/A"} Risk
                </p>
                <p className="text-xs text-muted-foreground">
                  Overall score
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <IconRiskFlag className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Key Findings
              </h3>
            </div>
            <div className="space-y-2">
              {riskReport.categories && Object.entries(riskReport.categories).slice(0, 4).map(([key, category]) => {
                if (category.severity === "low") return null
                return (
                  <div key={key} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        category.severity === "high" ? "bg-risk-high" : "bg-risk-medium"
                      )} />
                      <span className="font-medium text-foreground">{categoryLabels[key] ?? key}</span>
                      <span className="ml-auto text-muted-foreground tabular-nums" data-numeric>{category.score}</span>
                    </div>
                    {category.findings?.length > 0 && (
                      <p className="mt-0.5 text-muted-foreground line-clamp-1 pl-3">
                        {category.findings[0]?.title}
                      </p>
                    )}
                  </div>
                )
              })}
              {riskReport.categories && Object.values(riskReport.categories).every(c => c.severity === "low") && (
                <p className="text-xs text-muted-foreground">No significant findings</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Suggestions
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {riskReport.summary ?? ""}
            </p>
            {riskReport.recommendations?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {riskReport.recommendations.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <IconClient className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Client
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Run a risk analysis to see client insights and deal-specific flags here.
          </p>
        </div>
      )}
    </div>
  )
}
