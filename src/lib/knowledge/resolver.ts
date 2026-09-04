// Knowledge Resolver (Phase 5C).
//
// Deterministic: resolveKnowledge(context, items) returns structured
// candidates with relevance, applicability reasons, authority, and provenance.
// No LLM is involved — the resolver never invents knowledge. An empty store
// yields an empty result, which is valid and safer than false confidence.
// Conflicting sources coexist as independent candidates; resolution of real
// conflicts belongs to a later rules layer.

import type { ContextEnvelope } from "@/lib/context/schema"
import { evaluateApplicability } from "./applicability"
import { isEffectiveAt } from "./temporal"
import type { KnowledgeItem, KnowledgeStatus } from "./schema"

export interface KnowledgeCandidate {
  knowledgeItemId: string
  itemKey: string
  version: number
  title: string
  kind: KnowledgeItem["kind"]
  authority: KnowledgeItem["authority"]
  // 0-1 resolver relevance ("believed relevant to the supplied context"),
  // never legal certainty.
  relevance: number
  applicabilityReasons: string[]
  effectiveFrom: string
  effectiveTo: string | null
  sourceName: string
  sourceReference: string
  // Deal-type scope from the item's applicability block, when constrained.
  // Absent means unconstrained. Carried so verticals can filter without
  // re-resolving; it never decides eligibility by itself.
  applicabilityDealTypes?: Array<"freelance" | "generic">
}

export interface ResolveOptions {
  // Reference date for effective-date checks. Defaults to today (UTC).
  asOf?: Date | string
  // Only these statuses resolve. Defaults to published: drafts must never
  // become production authority, and superseded/withdrawn stay recoverable
  // through version history instead.
  includeStatuses?: KnowledgeStatus[]
  maxCandidates?: number
}

const DEFAULT_STATUSES: KnowledgeStatus[] = ["published"]

export function resolveKnowledge(
  envelope: ContextEnvelope,
  items: KnowledgeItem[],
  options: ResolveOptions = {}
): KnowledgeCandidate[] {
  if (!Array.isArray(items) || items.length === 0) return []
  const statuses = options.includeStatuses ?? DEFAULT_STATUSES
  const max = options.maxCandidates ?? 50
  const candidates: KnowledgeCandidate[] = []

  for (const item of items) {
    if (!statuses.includes(item.status)) continue
    if (!isEffectiveAt(item, options.asOf ?? new Date())) continue
    const evaluation = evaluateApplicability(item, envelope)
    if (!evaluation.eligible) continue
    candidates.push({
      knowledgeItemId: item.id,
      itemKey: item.itemKey,
      version: item.version,
      title: item.title,
      kind: item.kind,
      authority: item.authority,
      relevance: evaluation.relevance,
      applicabilityReasons: evaluation.reasons,
      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo,
      sourceName: item.provenance.source,
      sourceReference: item.provenance.sourceReference,
      applicabilityDealTypes: item.applicability.dealTypes,
    })
  }

  candidates.sort((a, b) => b.relevance - a.relevance || a.title.localeCompare(b.title))
  return candidates.slice(0, Math.max(0, max))
}
