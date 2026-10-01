// Home repo derivation — pure functions over already-persisted rows.
// Stage and risk are derived, never stored: Signed beats Signing beats
// Negotiation beats Analysis; risk is the worst FAIL severity.

import { isLockedStatus } from "@/lib/signing/transitions"
import type { RuleResult } from "@/lib/rules/result"

export type DealStage = "Analysis" | "Negotiation" | "Signing" | "Signed"
export type DealRisk = "Critical" | "Material" | "Attention" | "Clear"

export interface RepoAudit {
  id: string
  title: string
  dealType: string
  updatedAt: string
  findings: RuleResult[]
}

export interface RepoVersion {
  auditId: string
  status: string | null
}

export interface RepoDealRow {
  id: string
  title: string
  dealType: string
  stage: DealStage
  risk: DealRisk
  openIssues: number
  updatedAt: string
}

export interface RepoFilters {
  types: string[]
  stages: DealStage[]
  risks: DealRisk[]
}

function failCount(findings: RuleResult[]): number {
  return findings.filter((f) => f?.status === "FAIL").length
}

export function deriveRisk(findings: RuleResult[]): { risk: DealRisk; openIssues: number } {
  const fails = findings.filter((f) => f?.status === "FAIL")
  const severities = new Set(fails.map((f) => f.finding?.severity))
  if (severities.has("critical")) return { risk: "Critical", openIssues: fails.length }
  if (severities.has("material")) return { risk: "Material", openIssues: fails.length }
  if (severities.has("attention")) return { risk: "Attention", openIssues: fails.length }
  return { risk: "Clear", openIssues: fails.length }
}

export function deriveStage(failCountValue: number, versionStatuses: Array<string | null>): DealStage {
  if (versionStatuses.some((s) => isLockedStatus(s ?? ""))) return "Signed"
  if (versionStatuses.length > 0) return "Signing"
  if (failCountValue > 0) return "Negotiation"
  return "Analysis"
}

export function buildRepoRows(audits: RepoAudit[], versions: RepoVersion[]): RepoDealRow[] {
  const statusesByAudit = new Map<string, Array<string | null>>()
  for (const v of versions) {
    const list = statusesByAudit.get(v.auditId) ?? []
    list.push(v.status)
    statusesByAudit.set(v.auditId, list)
  }
  return audits.map((a) => {
    const fails = failCount(a.findings)
    const { risk } = deriveRisk(a.findings)
    return {
      id: a.id,
      title: a.title,
      dealType: a.dealType,
      stage: deriveStage(fails, statusesByAudit.get(a.id) ?? []),
      risk,
      openIssues: fails,
      updatedAt: a.updatedAt,
    }
  })
}

export function filterRepoRows(rows: RepoDealRow[], filters: RepoFilters): RepoDealRow[] {
  return rows.filter(
    (r) =>
      (filters.types.length === 0 || filters.types.includes(r.dealType)) &&
      (filters.stages.length === 0 || filters.stages.includes(r.stage)) &&
      (filters.risks.length === 0 || filters.risks.includes(r.risk))
  )
}

export function countBy<T extends string>(rows: RepoDealRow[], pick: (r: RepoDealRow) => T): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const key = pick(r)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}
