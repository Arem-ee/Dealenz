import { applyUserConfirmation, type ConfirmationUpdate } from "@/lib/context/confirm"
import { seedEnvelopeForDealType, type ContextEnvelope, type DealType } from "@/lib/context/schema"

// Seeds a fresh deal envelope from the user's business profile: jurisdiction
// from country, currency from default_currency. Both are the user's own
// entered data, so they land user_confirmed (the same standing as an
// explicit choice), and the confirm card stops asking what was already told.
// Best-effort throughout: a missing profile or a value the schema rejects
// yields the plain seed, never an error.

interface ProfileClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: unknown }>
      }
    }
  }
}

export async function seedEnvelopeWithProfile(
  client: ProfileClient,
  userId: string,
  dealType: DealType
): Promise<ContextEnvelope> {
  const seeded = seedEnvelopeForDealType(dealType)
  try {
    const { data } = await client
      .from("business_profiles")
      .select("country, default_currency")
      .eq("user_id", userId)
      .maybeSingle()
    const profile = (data ?? {}) as { country?: unknown; default_currency?: unknown }
    const updates: ConfirmationUpdate = {}
    if (typeof profile.country === "string" && profile.country.trim().length > 0) {
      updates.jurisdiction = { value: profile.country.trim() }
    }
    if (typeof profile.default_currency === "string" && profile.default_currency.trim().length > 0) {
      updates.transactionCurrency = { value: profile.default_currency.trim().toUpperCase() }
    }
    if (Object.keys(updates).length === 0) return seeded
    return applyUserConfirmation(seeded, updates)
  } catch {
    return seeded
  }
}
