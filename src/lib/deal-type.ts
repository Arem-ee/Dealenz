// Canonical deal-type normalization (Phase 22).
//
// Single home for the pure string→DealType mapping previously duplicated
// across server-action modules (which cannot export sync helpers: "use
// server" modules may only export async functions).

export type DealType = "freelance" | "generic" | "lease" | "purchase_sale" | "employment" | "founder" | "partnership"

const ALLOWED_DEAL_TYPES: ReadonlySet<string> = new Set([
  "freelance",
  "generic",
  "lease",
  "purchase_sale",
  "employment",
  "founder",
  "partnership",
])

export function normalizeDealType(input: unknown): DealType {
  if (typeof input === "string" && ALLOWED_DEAL_TYPES.has(input)) return input as DealType
  return "freelance"
}


