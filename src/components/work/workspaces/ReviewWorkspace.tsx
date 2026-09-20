"use client"

import { RiskReportCard } from "@/components/chat/cards/RiskReportCard"
import { Section } from "./Section"
import { OpenItemsList } from "./OpenItemsList"
import type { WorkspaceData } from "./types"

// Review is about understanding: severity-ordered findings with evidence,
// unresolved items, and the two honest next steps (ask, protect).
export function ReviewWorkspace({ data, dealType, riskLevel, overallScore, onAskFinding, onGenerateProtection }: {
  data: WorkspaceData
  dealType?: string | null
  riskLevel?: string
  overallScore?: number
  onAskFinding: (question: string) => void
  onGenerateProtection?: () => void
}) {
  const payload = {
    riskLevel: riskLevel ?? "Unknown",
    overallScore,
    findings: data.findings.map((f) => ({
      ruleKey: f.ruleKey,
      severity: f.severity,
      summary: f.summary,
      whyItMatters: f.whyItMatters,
      guidance: f.guidance,
      pushback: f.pushback,
      evidence: f.evidence ?? [],
    })),
  }
  return (
    <div>
      <Section
        title={`Issues found${data.findings.length > 0 ? ` (${data.findings.length})` : ""}`}
        hint="Deterministic findings from your deal input. AI explains them, never re-decides them."
      >
        <RiskReportCard payload={payload} onAskFinding={onAskFinding} />
      </Section>
      <Section title="Open items" hint="What still needs attention before you commit.">
        <OpenItemsList items={data.openItems} counts={data.openCounts} />
      </Section>
      <Section title="Next actions">
        <div className="flex flex-wrap gap-2">
          {dealType === "freelance" && onGenerateProtection && (
            <button
              type="button"
              onClick={onGenerateProtection}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Create protection
            </button>
          )}
          <p className="w-full text-xs text-muted-foreground">
            Ask about any finding above, or continue in the conversation. Protection documents generate from these findings.
          </p>
        </div>
      </Section>
    </div>
  )
}
