// Shared finding report mapping: deterministic findings -> public shape.
// Only FAIL findings travel; PASS/UNKNOWN never leave the account. Every
// field shown is the owner's own analysis output, published explicitly via
// a revocable tokenized link. Absent stays absent.

export interface SharedReportFinding {
  severity: string
  summary: string
  guidance?: string
  pushback?: string
  evidence?: Array<{ quote: string | null }>
}

export interface SharedReport {
  dealType: string
  riskLevel: string
  overallScore: number | null
  findings: SharedReportFinding[]
  findingCount: number
}

interface RawFinding {
  status?: string
  finding?: {
    severity?: unknown
    summary?: unknown
    guidance?: unknown
    pushback?: unknown
    evidence?: Array<{ quote?: unknown }> | unknown
  }
}

export function toSharedReport(input: {
  dealType?: string | null
  riskLevel?: string | null
  overallScore?: number | null
  deterministicFindings?: RawFinding[] | unknown
}): SharedReport {
  const raw = Array.isArray(input.deterministicFindings) ? (input.deterministicFindings as RawFinding[]) : []
  const findings: SharedReportFinding[] = []
  for (const r of raw) {
    if (!r || r.status !== "FAIL" || !r.finding) continue
    const summary = typeof r.finding.summary === "string" ? r.finding.summary : ""
    if (!summary) continue
    const severity = typeof r.finding.severity === "string" ? r.finding.severity : "informational"
    const out: SharedReportFinding = { severity, summary }
    if (typeof r.finding.guidance === "string" && r.finding.guidance) out.guidance = r.finding.guidance
    if (typeof r.finding.pushback === "string" && r.finding.pushback) out.pushback = r.finding.pushback
    if (Array.isArray(r.finding.evidence)) {
      const quotes = r.finding.evidence
        .filter((e) => e && typeof e === "object" && typeof (e as { quote?: unknown }).quote === "string")
        .slice(0, 2)
        .map((e) => ({ quote: (e as { quote: string }).quote }))
      if (quotes.length > 0) out.evidence = quotes
    }
    findings.push(out)
  }
  return {
    dealType: typeof input.dealType === "string" && input.dealType ? input.dealType : "unknown",
    riskLevel: typeof input.riskLevel === "string" && input.riskLevel ? input.riskLevel : "Unknown",
    overallScore: typeof input.overallScore === "number" ? input.overallScore : null,
    findings,
    findingCount: findings.length,
  }
}
