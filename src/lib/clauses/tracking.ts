// Clause tracking read-model — no migration.
//
// Derives per-deal clause states from already-persisted data only:
// - suggested: clause templates matching the deal's persisted FAIL findings
//   (findings → protection intents → protection category → clause lookup).
//   Never invented: no FAIL findings means no suggestions.
// - draft: the clause's document family has a generated version.
// - needs_input: the family's latest version still contains {{variables}}.
// - signed: the family's latest version reached fully_signed/locked.
//   `previouslySigned` stays true when an older version was locked and a
//   redraft is now in progress, so signed language is never misreported
//   as unsigned.
//
// Freelance generations (proposal/SOW/contract/checklist) and unknown
// document types carry no clause-library mapping and are ignored.

import { CLAUSE_LIBRARY, clauseById, clausesForProtectionCategory } from "@/lib/protection/clauses"
import { DOCUMENT_FAMILIES } from "@/lib/documents/families"
import { protectionIntentsFromFindings } from "@/lib/protection/intents"
import { isLockedStatus } from "@/lib/signing/transitions"
import type { RuleResult } from "@/lib/rules/result"

export type ClauseTrackStatus = "suggested" | "draft" | "needs_input" | "signed"

export interface ClauseTrackingAudit {
  id: string
  title: string
  dealType: string
  updatedAt: string
  findings: RuleResult[]
}

export interface ClauseTrackingVersion {
  id: string
  auditId: string
  documentType: string
  versionNumber: number
  status: string | null
  createdAt: string
  /** Only populated for the latest version per (audit, family). */
  content?: string | null
}

export interface TrackedClause {
  clauseId: string
  title: string
  purpose: string
  status: ClauseTrackStatus
  familyId: string | null
  familyTitle: string | null
  versionNumber: number | null
  /** Distinct unresolved {{variables}} in the latest version content. */
  missingVariables: string[]
  previouslySigned: boolean
}

export interface DealClauseState {
  auditId: string
  title: string
  dealType: string
  updatedAt: string
  clauses: TrackedClause[]
}

export function unresolvedVariables(content: string): string[] {
  const found = new Set<string>()
  for (const m of content.matchAll(/\{\{(\w+)\}\}/g)) found.add(m[1])
  return [...found].sort()
}

export function familyForDocumentType(documentType: string) {
  return DOCUMENT_FAMILIES.find((f) => f.id === documentType) ?? null
}

/** Clause ids suggested by the deal's persisted FAIL findings. Empty when unknown. */
export function suggestedClauseIdsForFindings(dealType: string, findings: RuleResult[]): string[] {
  if (!Array.isArray(findings) || findings.length === 0) return []
  const ids = new Set<string>()
  for (const intent of protectionIntentsFromFindings(dealType, findings, null)) {
    for (const c of clausesForProtectionCategory(dealType, intent.category)) ids.add(c.id)
  }
  return [...ids].sort()
}

export function deriveClauseTracking(
  audits: ClauseTrackingAudit[],
  versions: ClauseTrackingVersion[]
): DealClauseState[] {
  const byAudit = new Map<string, ClauseTrackingVersion[]>()
  for (const v of versions) {
    if (!v || typeof v.auditId !== "string") continue
    const list = byAudit.get(v.auditId) ?? []
    list.push(v)
    byAudit.set(v.auditId, list)
  }

  return audits.map((audit) => {
    const dealVersions = byAudit.get(audit.id) ?? []
    // Latest version per document family; non-family types carry no clauses.
    const latestByFamily = new Map<string, ClauseTrackingVersion>()
    for (const v of dealVersions) {
      if (!familyForDocumentType(v.documentType)) continue
      const cur = latestByFamily.get(v.documentType)
      if (!cur || v.versionNumber > cur.versionNumber) latestByFamily.set(v.documentType, v)
    }
    const everSignedByFamily = new Map<string, boolean>()
    for (const v of dealVersions) {
      if (!familyForDocumentType(v.documentType)) continue
      if (isLockedStatus(v.status ?? "")) everSignedByFamily.set(v.documentType, true)
    }

    const entries = new Map<string, TrackedClause>()
    const upsert = (clauseId: string, familyId: string | null) => {
      if (entries.has(clauseId)) return entries.get(clauseId)!
      const template = clauseById(clauseId)
      const family = familyId ? familyForDocumentType(familyId) : null
      const entry: TrackedClause = {
        clauseId,
        title: template?.title ?? clauseId,
        purpose: template?.purpose ?? "",
        status: "suggested",
        familyId,
        familyTitle: family?.title ?? null,
        versionNumber: null,
        missingVariables: [],
        previouslySigned: false,
      }
      entries.set(clauseId, entry)
      return entry
    };

    // Clauses used in generated documents first (they outrank suggestions).
    for (const [familyId, latest] of latestByFamily) {
      const family = familyForDocumentType(familyId)
      if (!family) continue
      const missing = typeof latest.content === "string" ? unresolvedVariables(latest.content) : []
      const signed = isLockedStatus(latest.status ?? "")
      for (const clauseId of family.clauseIds) {
        if (!CLAUSE_LIBRARY.some((c) => c.id === clauseId)) continue
        const entry = upsert(clauseId, familyId)
        entry.status = signed ? "signed" : missing.length > 0 ? "needs_input" : "draft"
        entry.versionNumber = latest.versionNumber
        entry.missingVariables = missing
        entry.previouslySigned = !signed && (everSignedByFamily.get(familyId) === true)
      }
    }
    // Suggestions for findings not yet covered by any generated document.
    for (const clauseId of suggestedClauseIdsForFindings(audit.dealType, audit.findings)) {
      upsert(clauseId, null)
    }

    const order: Record<ClauseTrackStatus, number> = { needs_input: 0, draft: 1, suggested: 2, signed: 3 }
    const clauses = [...entries.values()].sort(
      (a, b) => order[a.status] - order[b.status] || a.title.localeCompare(b.title)
    )
    return {
      auditId: audit.id,
      title: audit.title,
      dealType: audit.dealType,
      updatedAt: audit.updatedAt,
      clauses,
    }
  })
}
