// Protection boundary helpers (Phases 26-28).
//
// Protection intelligence (deterministic findings + negotiation synthesis)
// is available for every supported vertical. Document generation is only
// supported for freelance where the template/AI pipeline exists; founder,
// partnership, purchase_sale, lease, and employment have clause-level
// drafting assistance plus term-sheet families but not full generation.
// This module is the single source of truth for that boundary.

import type { DealType } from "@/lib/deal-type"

export * from "./intents"
export * from "./clauses"

// Only freelance supports the 4-document generation pipeline (proposal/SOW/
// contract/checklist via src/lib/generate.ts). Founder/partnership have
// protection intents + clause suggestions; full document generation remains
// partially implemented. All other verticals carry honest non-support.
const DOCUMENT_GENERATION_SUPPORTED = new Set<DealType>(["freelance"])

export function canGenerateDocuments(dealType: string): boolean {
  return DOCUMENT_GENERATION_SUPPORTED.has(dealType as DealType)
}

export const SUPPORTED_DOCUMENT_DEAL_TYPES: ReadonlyArray<DealType> = ["freelance"] as const
export const PROTECTED_DRAFT_SUPPORTED_DEAL_TYPES: ReadonlyArray<DealType> = ["founder", "partnership", "purchase_sale", "lease", "employment"] as const

export function documentGenerationUnavailableMessage(dealType: string): string {
  if (canGenerateDocuments(dealType)) return ""
  if ((PROTECTED_DRAFT_SUPPORTED_DEAL_TYPES as ReadonlyArray<string>).includes(dealType)) {
    return "Full document generation for this deal type is coming soon. Suggested protections and draft clauses are available below."
  }
  return "Document generation for this deal type is coming soon. You can still review the deal findings and negotiation priorities."
}

export function hasProtectionDraftSupport(dealType: string): boolean {
  return (PROTECTED_DRAFT_SUPPORTED_DEAL_TYPES as ReadonlyArray<string>).includes(dealType) || canGenerateDocuments(dealType)
}
