"use client"

import { useMemo } from "react"
import Link from "next/link"
import type { RuleResult } from "@/lib/rules/result"
import { protectionIntentsFromFindings } from "@/lib/protection/intents"
import { clausesForProtectionCategory, renderClauseTemplate } from "@/lib/protection/clauses"
import { EvidenceLine } from "@/components/evidence/evidence-line"
import { LegalCitationLine } from "@/components/evidence/legal-citation-line"

function priorityBadge(priority: string): string {
  switch (priority) {
    case "critical":
      return "bg-risk-critical/10 text-risk-critical"
    case "important":
      return "bg-risk-medium/10 text-risk-medium"
    default:
      return "bg-info/10 text-info"
  }
}

// Source-id prefix per jurisdiction country: a clause may reference several
// jurisdictions' sources, but only the matching country's id is shown, so a
// US deal never displays a Nigerian source id and vice versa.
function sourcePrefixForCountry(country: string | null | undefined): string | null {
  switch ((country ?? "").toLowerCase()) {
    case "united states":
      return "us-"
    case "united kingdom":
      return "uk-"
    case "european union":
      return "eu-"
    case "germany":
      return "de-"
    case "france":
      return "fr-"
    case "netherlands":
      return "nl-"
    case "nigeria":
    case "federal republic of nigeria":
      return "ng-"
    default:
      return null
  }
}

function ClausePreview({ dealType, category, variables, jurisdictionCountry }: { dealType: string; category: string; variables: Record<string, string>; jurisdictionCountry?: string | null }) {
  const clauses = clausesForProtectionCategory(dealType, category)
  if (clauses.length === 0) return null
  const clause = clauses[0]
  const { rendered, missing } = renderClauseTemplate(clause.template, variables)
  const prefix = sourcePrefixForCountry(jurisdictionCountry)
  const visibleIds = prefix ? clause.legalContextIds.filter((id) => id.startsWith(prefix)) : clause.legalContextIds
  return (
    <div className="mt-3 rounded-lg border border-warning/25 bg-warning/[0.06] p-3">
      <p className="text-xs font-semibold text-foreground">Suggested clause — drafting assistance</p>
      <p className="mt-1 text-xs font-medium">{clause.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{clause.purpose}</p>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed">{rendered}</p>
      {missing.length > 0 && (
        <p className="mt-2 text-xs text-warning-foreground">
          Missing: {missing.join(", ")} — UNKNOWN / NEEDS INPUT. Do not invent these values.
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">This is drafting assistance, not a determination of enforceability.</p>
      {clause.warnings.map((w) => (
        <p key={w} className="mt-1 text-[11px] text-muted-foreground">
          ⚠ {w}
        </p>
      ))}
      {visibleIds.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Legal context: {visibleIds.join(", ")}
        </p>
      )}
    </div>
  )
}

export function ProtectionIntentsView({
  dealType,
  findings,
  auditId,
  jurisdiction,
}: {
  dealType: string
  findings: RuleResult[]
  auditId: string
  jurisdiction?: import("@/lib/legal-research/types").Jurisdiction | null
}) {
  const intents = useMemo(() => protectionIntentsFromFindings(dealType, findings, jurisdiction ?? null), [dealType, findings, jurisdiction])

  if (intents.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <h3 className="text-sm font-semibold">Protection</h3>
        <p className="mt-1 text-xs text-muted-foreground">No protection priorities were raised for this deal. All checked terms appear to be addressed, but consider asking Dealenz or a lawyer about anything that feels unclear.</p>
        <Link href={`/ask?deal=${encodeURIComponent(auditId)}`} className="mt-3 inline-flex text-xs font-medium text-primary hover:underline">
          Ask about this deal →
        </Link>
      </div>
    )
  }

  const grouped = {
    critical: intents.filter((i) => i.priority === "critical"),
    important: intents.filter((i) => i.priority === "important"),
    consider: intents.filter((i) => i.priority === "consider"),
  }

  function renderGroup(label: string, items: typeof intents, color: string) {
    if (items.length === 0) return null
    return (
      <div className="space-y-3">
        <h4 className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</h4>
        {items.map((intent) => (
          <div key={intent.id} className="rounded-lg border border-border/60 bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <h5 className="text-sm font-semibold">{intent.title}</h5>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityBadge(intent.priority)}`}>
                {intent.priority}
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-muted-foreground">What is wrong</p>
            <p className="text-sm">{intent.problem}</p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">Why it matters</p>
            <p className="text-sm">{intent.rationale}</p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">Recommended protection</p>
            <p className="text-sm">{intent.recommendation}</p>
            {intent.variables.length > 0 && (
              <p className="mt-2 text-xs text-warning-foreground">
                Needs input: {intent.variables.join(", ")} — UNKNOWN until you provide it.
              </p>
            )}
            {intent.evidence.length > 0 && (
              <div className="mt-2 border-t border-border/60 pt-2">
                <p className="text-xs font-medium text-muted-foreground">Evidence</p>
                {intent.evidence.slice(0, 2).map((e) => (
                  <div key={e.id} className="mt-1">
                    <EvidenceLine evidence={e} />
                  </div>
                ))}
              </div>
            )}
            {intent.legalContext && (
              <div className="mt-2 border-t border-border/60 pt-2 text-xs">
                <p className="text-xs font-medium text-muted-foreground">Legal context — verified</p>
                <div className="mt-1">
                  <LegalCitationLine citation={intent.legalContext} />
                </div>
              </div>
            )}
            <ClausePreview dealType={dealType} category={intent.category} variables={{}} jurisdictionCountry={intent.legalContext?.jurisdiction ?? jurisdiction?.country ?? null} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold">Protection priorities</h3>
        <p className="mt-1 text-xs text-muted-foreground">What to negotiate, why it matters, and suggested protections — derived from authoritative findings, not rediscovered. Missing facts remain UNKNOWN.</p>
      </div>
      {renderGroup("Critical", grouped.critical, "text-destructive")}
      {renderGroup("Important", grouped.important, "text-warning-foreground")}
      {renderGroup("Consider", grouped.consider, "text-info")}
      <div className="rounded-lg border border-warning/25 bg-warning/[0.05] p-3">
        <p className="text-xs font-medium">Drafting assistance notice</p>
        <p className="mt-1 text-xs text-muted-foreground">Suggested clauses are drafting assistance, not statutory text and not a determination of enforceability. Legal sources above are the authority; the clause is the language you might negotiate. When enforceability matters, get a lawyer to confirm this applies to your facts.</p>
        <div className="mt-2 flex gap-2">
          <Link href={`/ask?deal=${encodeURIComponent(auditId)}`} className="text-xs font-medium text-primary hover:underline">
            Ask Dealenz
          </Link>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">Get lawyer help (coming soon)</span>
        </div>
      </div>
    </div>
  )
}

// Re-export for tests
export { protectionIntentsFromFindings } from "@/lib/protection/intents"
