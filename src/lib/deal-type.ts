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

export function normalizeDealType(input: unknown, fallback: DealType = "freelance"): DealType {
  if (typeof input === "string" && ALLOWED_DEAL_TYPES.has(input)) return input as DealType
  return fallback
}

// Deterministic deal-type auto-sort for batch intake (no AI, no credits).
//
// Counts distinct keyword-phrase hits per vertical over the contract text.
// The winner needs at least two distinct hits AND a strict margin over the
// runner-up; anything weaker — ties, single hits, no hits, empty text —
// falls back to generic, never to a guessed vertical. Generic is the honest
// bucket: universal rules plus adaptive AI themes, with no vertical's
// assumptions baked in. Deliberately conservative: single-word terms shared
// across verticals ("client", "payment", "deposit", "buyer") are excluded,
// and per-file human override stays available at intake.
const VERTICAL_SIGNALS: ReadonlyArray<{ type: Exclude<DealType, "generic">; phrases: ReadonlyArray<string> }> = [
  {
    type: "lease",
    phrases: ["landlord", "tenant", "tenancy", "lease agreement", "lease term", "monthly rent", "security deposit", "premises", "eviction", "rent due"],
  },
  {
    type: "employment",
    phrases: ["employer", "employee", "employment agreement", "offer of employment", "salary", "payroll", "job duties", "job title", "termination of employment"],
  },
  {
    type: "founder",
    phrases: ["co-founder", "cofounder", "founders agreement", "vesting", "vesting schedule", "cliff", "cap table", "equity split", "sweat equity"],
  },
  {
    type: "partnership",
    phrases: ["partnership agreement", "managing partner", "general partner", "limited partner", "profit sharing", "partnership interest", "dissolution of the partnership"],
  },
  {
    type: "purchase_sale",
    phrases: ["purchase agreement", "purchase price", "bill of sale", "purchase order", "title transfers", "delivery of the goods", "goods sold", "seller warrants"],
  },
  {
    type: "freelance",
    phrases: ["freelancer", "freelance", "deliverables", "scope of work", "revision rounds", "statement of work", "independent contractor", "client deliverables"],
  },
]

export function classifyDealTypeFromText(text: string): DealType {
  const lower = (text ?? "").toLowerCase()
  if (lower.trim().length === 0) return "generic"
  const scores = VERTICAL_SIGNALS.map(({ type, phrases }) => ({
    type,
    hits: phrases.filter((p) => lower.includes(p)).length,
  })).sort((a, b) => b.hits - a.hits)
  const [best, runnerUp] = scores
  if (best.hits >= 2 && best.hits > (runnerUp?.hits ?? 0)) return best.type
  return "generic"
}


