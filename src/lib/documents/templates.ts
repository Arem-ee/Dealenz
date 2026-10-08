// One-click template catalog — pure helpers for the Templates tab.
//
// DOCUMENT_FAMILIES is the catalog (code-defined, no table). These helpers
// shape it for the UI and validate one-click creation input. Assembly +
// persistence live in src/app/(app)/templates/actions.ts.

import { DOCUMENT_FAMILIES, familyById } from "./families"
import { getRequiredVariablesForFamily } from "./variable-autofill"

export interface TemplateOption {
  id: string
  title: string
  description: string
  dealType: string
  variables: string[]
}

const DEAL_TYPE_LABELS: Record<string, string> = {
  founder: "Founder",
  partnership: "Partnership",
  purchase_sale: "Purchase/Sale",
  lease: "Lease",
  employment: "Employment",
  freelance: "Freelance",
}

export function templateDealTypeLabel(dealType: string): string {
  return DEAL_TYPE_LABELS[dealType] ?? dealType
}

/** Catalog options, optionally filtered by deal-type label ("All" = no filter). */
export function listTemplateOptions(dealTypeLabel?: string): TemplateOption[] {
  return DOCUMENT_FAMILIES.filter((f) => {
    if (!dealTypeLabel || dealTypeLabel === "All") return true
    return f.dealTypes.some((d) => templateDealTypeLabel(d) === dealTypeLabel)
  }).map((f) => {
    const dealType = f.dealTypes[0] ?? "generic"
    return {
      id: f.id,
      title: f.title,
      description: f.description,
      dealType,
      variables: getRequiredVariablesForFamily(f.id, dealType).filter((v) => v !== "jurisdiction"),
    }
  })
}

/** Primary deal type for a family id, or null when unknown. */
export function defaultDealTypeForFamily(familyId: string): string | null {
  const family = familyById(familyId)
  if (!family || family.dealTypes.length === 0) return null
  return family.dealTypes[0]!
}
