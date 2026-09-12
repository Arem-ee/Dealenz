// Deterministic findings panel for the audit workspace (Phase 8 → Phase 15 decision-support).
//
// Phase 15: improves the same panel (no second findings system) into a
// decision-support surface. For every FAIL finding it renders the existing
// semantic chain What was observed → Why it matters → What to clarify →
// Evidence, preserving severity, summary, guidance, quote, location,
// provenance, EXACT/APPROXIMATE/UNAVAILABLE. UNKNOWN is visually and
// semantically distinct from FAIL and PASS. No aggregate score, no evidence
// fabrication. Reuses the same Evidence model + inspect + viewer.

"use client"

import { useState } from "react"
import Link from "next/link"
import type { RuleResult } from "@/lib/rules/result"
import { EvidenceLine } from "@/components/evidence/evidence-line"
import { DocumentViewerModal } from "@/components/evidence/document-viewer"
import type { Evidence } from "@/lib/evidence/schema"

function isRuleResult(value: unknown): value is RuleResult {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.ruleKey === "string" &&
    (record.status === "PASS" || record.status === "FAIL" || record.status === "UNKNOWN")
  )
}

export function parsePersistedFindings(raw: unknown): RuleResult[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isRuleResult)
}

function severityBadge(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-risk-critical/10 text-risk-critical"
    case "material":
      return "bg-risk-high/10 text-risk-high"
    case "attention":
      return "bg-risk-medium/10 text-risk-medium"
    case "informational":
    default:
      return "bg-muted text-muted-foreground"
  }
}

function whyMatters(severity: string): string {
  switch (severity) {
    case "critical":
      return "Why it matters: likely to affect your rights or obligations. Clarify before signing."
    case "material":
      return "Why it matters: could materially affect payment, scope, liability, or risk."
    case "attention":
      return "Why it matters: worth confirming to avoid later disagreement or added cost."
    case "informational":
    default:
      return "Why it matters: helpful context for a complete picture."
  }
}

export function FindingsPanel({ auditId, results }: { auditId: string; results: RuleResult[] }) {
  const [viewer, setViewer] = useState<Evidence | null>(null)
  const [showUnknown, setShowUnknown] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const fails = results.filter((r) => r.status === "FAIL" && r.finding)
  const unknowns = results.filter((r) => r.status === "UNKNOWN")
  const passes = results.filter((r) => r.status === "PASS")
  const hasResults = results.length > 0

  if (!hasResults) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold">Deterministic checks</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          No checks have run yet. Add deal details and run analysis to see what needs attention.
        </p>
        <Link
          href={`/ask?deal=${encodeURIComponent(auditId)}`}
          className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
        >
          Ask about this deal →
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Deal checks — attention needed</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {fails.length === 0
              ? "No flagged checks. Review the inconclusive and passed sections below for context."
              : `${fails.length} flagged · ${unknowns.length} inconclusive · ${passes.length} passed`}
          </p>
        </div>
        <Link
          href={`/ask?deal=${encodeURIComponent(auditId)}`}
          className="shrink-0 rounded-md border border-border/60 px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted"
        >
          Ask about this deal
        </Link>
      </div>

      {fails.length === 0 ? (
        <p className="mt-3 rounded-lg border border-success/20 bg-success/[0.05] px-3 py-2 text-xs text-success">
          All evaluated checks passed. If some checks are inconclusive (below), they reflect missing information — not confirmed safety.
        </p>
      ) : null}

      {fails.length > 0 && (
        <div className="mt-4 space-y-3">
          {fails.map((result) => {
            const finding = result.finding!
            const evidence = Array.isArray(finding.evidence) ? finding.evidence : []
            const hasEvidence = evidence.length > 0
            return (
              <div
                key={result.ruleKey}
                className="rounded-lg border border-border/60 p-3"
                data-testid={`finding-${result.ruleKey}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${severityBadge(finding.severity)}`}>
                    {finding.severity}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{result.ruleKey}</span>
                </div>
                <p className="mt-2 text-[13px] font-medium">What needs attention: {finding.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">{whyMatters(finding.severity)}</p>
                {finding.guidance ? (
                  <p className="mt-2 text-xs">
                    <span className="font-medium">What to clarify: </span>
                    <span className="text-muted-foreground">{finding.guidance}</span>
                  </p>
                ) : null}
                {hasEvidence ? (
                  <div className="mt-2 rounded-md bg-muted/40 p-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Evidence — what was observed</p>
                    {evidence.slice(0, 2).map((item) => (
                      <div key={item.id} className="mt-1.5 space-y-1">
                        <EvidenceLine evidence={item} />
                        {item.inspectable && item.sourceType !== "knowledge" ? (
                          <button
                            type="button"
                            onClick={() => setViewer(item)}
                            className="text-[11px] font-medium text-primary hover:underline"
                          >
                            Inspect source
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    No direct quote was observed for this check. The finding reflects what was missing in the provided input, not a located passage.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* UNKNOWN — visually and semantically distinct from FAIL, not a confirmed problem */}
      {unknowns.length > 0 && (
        <div className="mt-4 rounded-lg border border-warning/25 bg-warning/[0.06] p-3">
          <button
            type="button"
            onClick={() => setShowUnknown((v) => !v)}
            className="flex w-full items-center justify-between text-left"
            aria-expanded={showUnknown}
          >
            <span className="text-xs font-medium text-foreground">
              {unknowns.length} inconclusive check{unknowns.length === 1 ? "" : "s"} — needs more information
            </span>
            <span className="text-xs text-muted-foreground">{showUnknown ? "Hide" : "Show"}</span>
          </button>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            These checks could not be determined from the information provided. They are not flagged as problems and do not indicate safety.
          </p>
          {showUnknown && (
            <ul className="mt-2 space-y-1.5">
              {unknowns.map((r) => (
                <li key={r.ruleKey} className="rounded-md bg-white px-2.5 py-2 text-xs" data-testid={`unknown-${r.ruleKey}`}>
                  <span className="font-medium">{r.ruleKey}</span>
                  <span className="text-muted-foreground"> — {r.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* PASS — collapsed by default, never rendered as a problem */}
      {passes.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            aria-expanded={showPass}
          >
            {showPass ? "Hide" : "Show"} {passes.length} passed check{passes.length === 1 ? "" : "s"}
          </button>
          {showPass && (
            <ul className="mt-2 space-y-1 rounded-md border border-border/60 bg-muted/30 p-2">
              {passes.map((r) => (
                <li key={r.ruleKey} className="text-[11px] text-muted-foreground" data-testid={`pass-${r.ruleKey}`}>
                  {r.ruleKey}: {r.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {viewer ? (
        <DocumentViewerModal auditId={auditId} evidence={viewer} onClose={() => setViewer(null)} />
      ) : null}
    </div>
  )
}
