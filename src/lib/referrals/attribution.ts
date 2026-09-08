import { normalizeReferralCode, REFERRAL_COOKIE } from "./policy"

// Dependencies are injected so the orchestration below is unit-testable
// without Supabase. Every dependency mirrors a server-side primitive:
// cookie access via next/headers, ownership-scoped queries, RPCs, logging.
export interface ReferralAttributionDeps {
  getCookie: (name: string) => string | undefined
  clearCookie: (name: string) => void
  // Other audits of this user already in analyzed status (excluding the
  // current one). Empty means this is the user's first successful analysis.
  findOtherAnalyzedAudits: () => Promise<Array<{ id: string }>>
  // Resolves to true when the attribution row was newly created.
  attributeReferral: (code: string) => Promise<boolean>
  // Resolves to true when a reward was granted by this call.
  claimReward: () => Promise<boolean>
  log: (event: string, payload: Record<string, unknown>) => Promise<void>
}

// Runs referral bookkeeping after a successful analyzeDeal. Never throws:
// bookkeeping must never fail an analysis.
//
// Invariants enforced here:
// - Referral is an account-creation attribution, not an identity-linking
//   event. Attribution happens only when this is the user's first
//   successful analysis; existing users (stale cookie, post-linking
//   analysis) are never attributed here.
// - Reward claiming still runs on every success so a pending attribution
//   created earlier is eventually rewarded exactly once (the RPC is
//   idempotent).
export async function processReferralPostAnalysis(deps: ReferralAttributionDeps): Promise<void> {
  try {
    const refCode = normalizeReferralCode(deps.getCookie(REFERRAL_COOKIE))
    if (refCode) {
      let isFirstAnalysis = false
      try {
        const others = await deps.findOtherAnalyzedAudits()
        isFirstAnalysis = others.length === 0
      } catch {
        // Ownership/history lookup failed: fail closed on attribution, but
        // still allow the idempotent reward claim below.
        isFirstAnalysis = false
      }
      if (isFirstAnalysis) {
        try {
          const attributed = await deps.attributeReferral(refCode)
          if (attributed) {
            await deps.log("referral_attributed", { code: refCode })
            try {
              deps.clearCookie(REFERRAL_COOKIE)
            } catch {
              // Cookie cleanup is opportunistic only.
            }
          }
          // Transient attribution failures keep the cookie so the next
          // successful analysis retries.
        } catch {
          // Best-effort: retried on the next successful analysis.
        }
      } else {
        // Stale cookie on an existing account: never attribute here, drop
        // the cookie so later analyses skip the lookup.
        try {
          deps.clearCookie(REFERRAL_COOKIE)
        } catch {
          // Cookie cleanup is opportunistic only.
        }
      }
    }
    try {
      const rewarded = await deps.claimReward()
      if (rewarded) {
        await deps.log("referral_rewarded", {})
      }
    } catch {
      // Best-effort: retried on the next successful analysis.
    }
  } catch {
    // Referral bookkeeping must never fail an analysis.
  }
}
