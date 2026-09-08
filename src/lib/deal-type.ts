// Canonical deal-type normalization (Phase 22).
//
// Single home for the pure string→DealType mappings previously duplicated
// across server-action modules (which cannot export sync helpers: "use
// server" modules may only export async functions). Semantics preserved
// exactly: unknown/unrecognized input falls back to freelance in
// authenticated paths and to generic in the anonymous path — never to a
// specialized vertical.

export type DealType = "freelance" | "generic" | "lease" | "purchase_sale" | "employment" | "founder"

const ALLOWED_DEAL_TYPES: ReadonlySet<string> = new Set([
  "freelance",
  "generic",
  "lease",
  "purchase_sale",
  "employment",
  "founder",
])

export function normalizeDealType(input: unknown): DealType {
  if (typeof input === "string" && ALLOWED_DEAL_TYPES.has(input)) return input as DealType
  return "freelance"
}

export function normalizeAnonymousDealType(input?: string): DealType {
  if (input === "freelance") return "freelance"
  if (input === "lease") return "lease"
  if (input === "purchase_sale") return "purchase_sale"
  if (input === "employment") return "employment"
  if (input === "founder") return "founder"
  // Unknown or absent input takes the adaptive generic path, never a
  // specialized vertical. The landing UI always sends an explicit value.
  return "generic"
}
