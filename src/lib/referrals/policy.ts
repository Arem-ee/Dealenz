// Referral policy constants (Phase 22, Sub-phase C).
//
// PROVISIONAL — requires product sign-off before production activation.
// REFERRAL_REWARD_CREDITS must match v_amount in
// supabase/migrations/00033_referral_system.sql (claim_referral_reward).
// The amount is enforced server-side inside the RPC; this constant exists
// only so the UI can display the same number honestly. Do NOT treat this
// value as product-approved pricing.

export const REFERRAL_REWARD_CREDITS = 5

// Referral codes are 8 uppercase alphanumerics, generated server-side by
// ensure_referral_code(). The client never chooses or validates authority.
export const REFERRAL_CODE_RE = /^[A-Z0-9]{8}$/

export const REFERRAL_COOKIE = "dealenz_ref"
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export function normalizeReferralCode(input: unknown): string | null {
  if (typeof input !== "string") return null
  const code = input.trim().toUpperCase()
  return REFERRAL_CODE_RE.test(code) ? code : null
}
