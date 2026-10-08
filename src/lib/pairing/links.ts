// Pairing structure check — pure validation for position↔language links (D5).
//
// A sound pairing: the preferred slot exists and is condition-free (it is
// the standing rule, not a concession), fallback rungs carry when/why
// conditions (a condition-less fallback fires at nobody's discretion), the
// walk-away floor exists. Violations warn inline, never block — the library
// stays usable while incomplete.

import type { LibraryClauseVariant } from "@/lib/library/entries"

export interface PairingLink {
  libraryKey: string
  variant: LibraryClauseVariant
  rung: number
  conditionText: string
  escalate: boolean
  insertOnMissing: boolean
}

export interface StructureWarning {
  code: "missing_preferred" | "conditionless_fallback" | "missing_walkaway" | "escalate_without_ladder"
  message: string
}

/** Links of one position, ordered best-first (preferred, then rungs). */
export function orderLinks(links: PairingLink[]): PairingLink[] {
  const slot: Record<LibraryClauseVariant, number> = { preferred: 0, fallback: 1, walkaway: 2 }
  return [...links].sort((a, b) => slot[a.variant] - slot[b.variant] || a.rung - b.rung)
}

export function checkLinkStructure(links: PairingLink[]): StructureWarning[] {
  const warnings: StructureWarning[] = []
  if (links.length === 0) return warnings
  const ordered = orderLinks(links)
  const preferred = ordered.find((l) => l.variant === "preferred")
  if (!preferred) {
    warnings.push({
      code: "missing_preferred",
      message: "No preferred language linked — link the standing wording first.",
    })
  }
  const fallbacks = ordered.filter((l) => l.variant === "fallback")
  if (fallbacks.some((l) => l.conditionText.trim().length === 0)) {
    warnings.push({
      code: "conditionless_fallback",
      message: "A fallback has no when/why — it will fire at nobody's discretion.",
    })
  }
  const walkaway = ordered.find((l) => l.variant === "walkaway")
  if (!walkaway) {
    warnings.push({
      code: "missing_walkaway",
      message: "No walk-away floor — this position concedes under pressure.",
    })
  }
  if (!walkaway && ordered.some((l) => l.escalate)) {
    warnings.push({
      code: "escalate_without_ladder",
      message: "Escalation without a walk-away floor escalates everything.",
    })
  }
  return warnings
}
