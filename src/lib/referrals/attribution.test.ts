import { describe, it, expect, vi } from "vitest"
import { processReferralPostAnalysis, type ReferralAttributionDeps } from "./attribution"
import { REFERRAL_COOKIE } from "./policy"

function deps(overrides: Partial<ReferralAttributionDeps> = {}): ReferralAttributionDeps & {
  calls: { attribute: string[]; claim: number; logs: Array<{ event: string }> }
} {
  const calls = { attribute: [] as string[], claim: 0, logs: [] as Array<{ event: string }> }
  return {
    calls,
    getCookie: () => undefined,
    clearCookie: () => {},
    findOtherAnalyzedAudits: async () => [],
    attributeReferral: async (code: string) => {
      calls.attribute.push(code)
      return true
    },
    claimReward: async () => {
      calls.claim += 1
      return false
    },
    log: async (event: string) => {
      calls.logs.push({ event })
    },
    ...overrides,
  }
}

describe("processReferralPostAnalysis", () => {
  it("attributes and rewards on first successful analysis with a valid cookie", async () => {
    const d = deps({ getCookie: (name) => (name === REFERRAL_COOKIE ? "abc123xy" : undefined) })
    await processReferralPostAnalysis(d)
    expect(d.calls.attribute).toEqual(["ABC123XY"])
    expect(d.calls.claim).toBe(1)
    expect(d.calls.logs.map((l) => l.event)).toContain("referral_attributed")
  })

  it("never attributes an existing account, but still claims pending rewards", async () => {
    const cleared: string[] = []
    const d = deps({
      getCookie: (name) => (name === REFERRAL_COOKIE ? "abc123xy" : undefined),
      clearCookie: (name) => {
        cleared.push(name)
      },
      findOtherAnalyzedAudits: async () => [{ id: "old-audit" }],
      claimReward: async () => {
        d.calls.claim += 1
        return true
      },
    })
    await processReferralPostAnalysis(d)
    expect(d.calls.attribute).toEqual([])
    expect(d.calls.claim).toBe(1)
    expect(cleared).toEqual([REFERRAL_COOKIE])
    expect(d.calls.logs.map((l) => l.event)).toContain("referral_rewarded")
    expect(d.calls.logs.map((l) => l.event)).not.toContain("referral_attributed")
  })

  it("skips attribution without a cookie but still claims", async () => {
    const d = deps()
    await processReferralPostAnalysis(d)
    expect(d.calls.attribute).toEqual([])
    expect(d.calls.claim).toBe(1)
  })

  it("ignores malformed cookie values", async () => {
    const d = deps({ getCookie: () => "not a code!!" })
    await processReferralPostAnalysis(d)
    expect(d.calls.attribute).toEqual([])
    expect(d.calls.claim).toBe(1)
  })

  it("fails closed on history lookup errors: no attribution, claim still runs", async () => {
    const d = deps({
      getCookie: (name) => (name === REFERRAL_COOKIE ? "abc123xy" : undefined),
      findOtherAnalyzedAudits: async () => {
        throw new Error("db down")
      },
    })
    await processReferralPostAnalysis(d)
    expect(d.calls.attribute).toEqual([])
    expect(d.calls.claim).toBe(1)
  })

  it("transient attribution failures keep the cookie for retry", async () => {
    const cleared: string[] = []
    const d = deps({
      getCookie: (name) => (name === REFERRAL_COOKIE ? "abc123xy" : undefined),
      clearCookie: (name) => {
        cleared.push(name)
      },
      attributeReferral: async () => {
        throw new Error("db down")
      },
    })
    await processReferralPostAnalysis(d)
    expect(cleared).toEqual([])
    expect(d.calls.claim).toBe(1)
  })

  it("never throws, even when every dependency fails", async () => {
    const d = deps({
      getCookie: () => {
        throw new Error("no cookies")
      },
      claimReward: async () => {
        throw new Error("db down")
      },
      log: async () => {
        throw new Error("log down")
      },
    })
    await expect(processReferralPostAnalysis(d)).resolves.toBeUndefined()
  })
})
