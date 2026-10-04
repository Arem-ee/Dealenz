import { formatPrice, type Currency } from "@/lib/billing/catalog"
import { applyUserConfirmation } from "@/lib/context/confirm"
import { emptyContextEnvelope, parseContextEnvelope } from "@/lib/context/schema"

// Deal value parsing and display — pure. Amounts enter as human decimal
// strings ("48,500.00") and store as integer minor units; the envelope
// mirrors them as major-unit numbers per the context schema. History is
// NULL (absent), never zero — zero corrupts sums.

export const DEAL_CURRENCIES = ["USD", "GBP", "EUR", "NGN"] as const
export type DealCurrency = (typeof DEAL_CURRENCIES)[number]

export function isDealCurrency(value: unknown): value is DealCurrency {
  return typeof value === "string" && (DEAL_CURRENCIES as readonly string[]).includes(value)
}

export function parseDealValue(input: { amount: unknown; currency: unknown }): { minor: number; currency: DealCurrency } | { error: string } {
  const { amount, currency } = input
  if (!isDealCurrency(currency)) return { error: "Currency must be USD, GBP, EUR, or NGN." }
  if (typeof amount !== "string" && typeof amount !== "number") return { error: "Enter an amount." }
  const cleaned = String(amount).replace(/[,_\s]/g, "")
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { error: "Amount must be a number with at most 2 decimals." }
  const minor = Math.round(Number(cleaned) * 100)
  if (!Number.isSafeInteger(minor) || minor <= 0) return { error: "Amount must be positive." }
  if (minor > 1e12 * 100) return { error: "Amount is too large." }
  return { minor, currency }
}

export function formatDealValue(minor: number, currency: string): string {
  if (currency === "USD" || currency === "GBP" || currency === "EUR") {
    return formatPrice(minor, currency as Currency)
  }
  return `${currency} ${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Envelope sync for value writes: user_confirmed major-unit fields. */
export function envelopeWithValue(existing: unknown, minor: number, currency: string) {
  const base = existing ? parseContextEnvelope(existing) : emptyContextEnvelope()
  return applyUserConfirmation(base, {
    transactionValue: { value: minor / 100, confidence: 1 },
    transactionCurrency: { value: currency, confidence: 1 },
  })
}

/** Per-currency totals over rows carrying values; NULL rows excluded. */
export function sumByCurrency(rows: Array<{ minor: number | null; currency: string | null }>): Array<{ currency: string; total: number; deals: number }> {
  const sums = new Map<string, { total: number; deals: number }>()
  for (const r of rows) {
    if (r.minor === null || r.minor === undefined || !r.currency) continue
    const slot = sums.get(r.currency) ?? { total: 0, deals: 0 }
    slot.total += r.minor
    slot.deals += 1
    sums.set(r.currency, slot)
  }
  return [...sums.entries()]
    .map(([currency, s]) => ({ currency, total: s.total, deals: s.deals }))
    .sort((a, b) => b.total - a.total)
}
