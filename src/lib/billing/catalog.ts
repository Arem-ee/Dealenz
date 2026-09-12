// Credit package catalog — international, provider-independent (Phase 29).
//
// Packages are the product; provider prices are the settlement mechanism.
// Credits are the monetization primitive; amount/credits are server-authoritative.
// Prices are in minor units (cents/pence) per currency to avoid float.
// This file is the single source for package identity; do not scatter prices in JSX.

export type Currency = "USD" | "GBP" | "EUR"

export interface CreditPackage {
  id: string // stable, provider-independent: starter | standard | pro
  credits: number
  prices: Record<Currency, number> // minor units: e.g. USD 1900 = $19.00
  active: boolean
  // Lemon Squeezy variant ids live in environment (LEMONSQUEEZY_VARIANT_*,
  // resolved by src/lib/billing/provider.ts), never as code constants.
  description: string
}

// Canonical catalog — easy to change, never trust client values.
// USD/GBP/EUR support US/UK/Europe (initial target markets). NGN is not offered.
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter",
    credits: 50,
    prices: { USD: 1900, GBP: 1500, EUR: 1800 },
    active: true,
    description: "Starter — 50 credits",
  },
  {
    id: "standard",
    credits: 150,
    prices: { USD: 4900, GBP: 3900, EUR: 4900 },
    active: true,
    description: "Standard — 150 credits",
  },
  {
    id: "pro",
    credits: 400,
    prices: { USD: 9900, GBP: 7900, EUR: 9900 },
    active: true,
    description: "Pro — 400 credits",
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
export function validatePurchaseInput(input: { packageId: unknown; currency: unknown }): { package: CreditPackage; currency: Currency } | { error: string } {
  if (typeof input.packageId !== "string" || typeof input.currency !== "string") {
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
