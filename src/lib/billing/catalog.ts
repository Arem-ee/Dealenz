// Credit package catalog — international, provider-independent (Phase 29).
//
// Packages are the product; provider prices are the settlement mechanism.
// Credits are the monetization primitive; amount/credits are server-authoritative.
// Prices are in minor units (cents/pence) per currency to avoid float.
// This file is the single source for package identity; do not scatter prices in JSX.
//
// IMPORTANT: the Paddle prices behind PADDLE_PRICE_* must equal these
// amounts. The webhook rejects any payment below catalog (400) and flags
// drift — repricing here without updating Paddle breaks checkout.

import { CREDIT_PRICE_BRIEF, DOCUMENT_CREDIT_COSTS, SIGNATURE_SEND_CREDITS } from "@/lib/credits/pricing"

export type Currency = "USD" | "GBP" | "EUR"

export interface CreditPackage {
  id: string // stable, provider-independent: starter | standard | pro
  credits: number
  prices: Record<Currency, number> // minor units: e.g. USD 1900 = $19.00
  active: boolean
  // Paddle price ids live in environment (PADDLE_PRICE_*,
  // resolved by src/lib/billing/provider.ts), never as code constants.
  description: string
}

// Canonical catalog — easy to change, never trust client values.
// USD/GBP/EUR support US/UK/Europe (initial target markets). NGN is not offered.
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter",
    credits: 50,
    prices: { USD: 999, GBP: 799, EUR: 949 },
    active: true,
    description: "50 credits, one-time top-up",
  },
  {
    id: "standard",
    credits: 150,
    prices: { USD: 2499, GBP: 1999, EUR: 2399 },
    active: true,
    description: "150 credits, one-time top-up",
  },
  {
    id: "pro",
    credits: 400,
    prices: { USD: 5999, GBP: 4799, EUR: 5699 },
    active: true,
    description: "400 credits, one-time top-up",
  },
]

export function getPackage(packageId: string): CreditPackage | null {
  return CREDIT_PACKAGES.find((p) => p.id === packageId) ?? null
}

export function isActivePackage(pkg: CreditPackage | null): boolean {
  return pkg !== null && pkg.active
}

export function priceForPackage(pkg: CreditPackage, currency: Currency): number {
  return pkg.prices[currency]
}

export function formatPrice(amountMinor: number, currency: Currency): string {
  const major = amountMinor / 100
  const formatter = new Intl.NumberFormat(currency === "USD" ? "en-US" : currency === "GBP" ? "en-GB" : "de-DE", {
    style: "currency",
    currency,
  })
  return formatter.format(major)
}

// Server-side validation: never trust client amount/credits
export function validatePurchaseInput(input: { packageId: unknown; currency: unknown }): { package: CreditPackage; currency: Currency } | { error: string } {  if (typeof input.packageId !== "string" || typeof input.currency !== "string") {
    return { error: "Invalid package or currency" }
  }
  const pkg = getPackage(input.packageId)
  if (!pkg) return { error: "Unknown package" }
  if (!pkg.active) return { error: "Package is not active" }
  if (input.currency !== "USD" && input.currency !== "GBP" && input.currency !== "EUR") {
    return { error: "Unsupported currency" }
  }
  return { package: pkg, currency: input.currency as Currency }
}

// What a pack buys, derived from the live credit prices so listings can
// never drift from the price list. "About" throughout: real mixes vary.
const FULL_DEAL_COST = DOCUMENT_CREDIT_COSTS.proposal + SIGNATURE_SEND_CREDITS

export function packageValueLines(credits: number): string[] {
  const plural = (n: number, one: string, many: string) => `≈ ${n} ${n === 1 ? one : many}`
  return [
    plural(Math.floor(credits / FULL_DEAL_COST), "full deal loop", "full deal loops"),
    plural(Math.floor(credits / DOCUMENT_CREDIT_COSTS.proposal), "proposal", "proposals"),
    plural(Math.floor(credits / CREDIT_PRICE_BRIEF), "quick answer", "quick answers"),
  ]
}
