// International document family types (Phase 28+).
//
// Jurisdiction-neutral core: families are defined by dealType + protection
// category, not by country. Legal context (jurisdiction, citations, temporal
// status) is attached at assembly time.

import type { ClauseCategory, ClauseTemplate } from "@/lib/protection/clauses"
import type { LegalCitation } from "@/lib/legal-research/types"
import type { ProtectionIntent } from "@/lib/protection/intents"

export type DocumentFamilyId =
  | "founder-agreement"
  | "shareholders-agreement"
  | "founder-ip-assignment"
  | "vesting-schedule"
  | "partnership-agreement"
  | "llp-agreement"
  | "contribution-schedule"
  | "profit-schedule"
  | "purchase-terms-sheet"
  | "lease-terms-summary"
  | "employment-terms-summary"

export type DocumentDealType = "founder" | "partnership" | "purchase_sale" | "lease" | "employment"

export interface DocumentFamily {
  id: DocumentFamilyId
  dealTypes: DocumentDealType[]
  title: string
  description: string
  protectionCategories: ClauseCategory[]
  requiredJurisdiction: boolean // true when jurisdiction is legally material
  clauseIds: string[] // ordered ClauseTemplate ids
  legalContextIds: string[] // default legal source ids for this family
}

export interface DocumentVariables {
  [key: string]: string // e.g. founder_names, ownership_percentages, jurisdiction
}

export interface DocumentProvenance {
  dealType: string
  jurisdiction: { country: string; region?: string | null }
  protectionIntents: ProtectionIntent[]
  clauses: ClauseTemplate[]
  citations: LegalCitation[]
  missingVariables: string[]
  generatedAt: string
}

export interface DraftDocument {
  familyId: DocumentFamilyId
  title: string
  markdown: string
  variables: DocumentVariables
  missingVariables: string[]
  citations: LegalCitation[]
  provenance: DocumentProvenance
  warnings: string[]
}
