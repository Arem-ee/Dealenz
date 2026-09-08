import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
  REFERRAL_CODE_RE,
  REFERRAL_COOKIE,
  REFERRAL_REWARD_CREDITS,
  normalizeReferralCode,
} from "./policy"

describe("referral policy", () => {
  it("exposes a positive server-owned reward amount", () => {
    expect(Number.isInteger(REFERRAL_REWARD_CREDITS)).toBe(true)
    expect(REFERRAL_REWARD_CREDITS).toBeGreaterThan(0)
  })

  it("accepts only well-formed codes", () => {
    expect(normalizeReferralCode("abc123xy")).toBe("ABC123XY")
    expect(normalizeReferralCode("  abc123xy  ")).toBe("ABC123XY")
    expect(normalizeReferralCode("short")).toBeNull()
    expect(normalizeReferralCode("toolongcode1")).toBeNull()
    expect(normalizeReferralCode("abc-123x")).toBeNull()
    expect(normalizeReferralCode("'; DROP TABLE--")).toBeNull()
    expect(normalizeReferralCode(null)).toBeNull()
    expect(normalizeReferralCode(123 as unknown as string)).toBeNull()
    expect(REFERRAL_CODE_RE.test("ABC123XY")).toBe(true)
  })

  it("uses a namespaced cookie key", () => {
    expect(REFERRAL_COOKIE).toBe("dealenz_ref")
  })
})

describe("Google linking never touches referral state", () => {
  // Linking attaches an identity to the existing canonical user; it must
  // neither create attributions nor grant rewards. Pin the call sites: the
  // only modules allowed to invoke referral RPCs are the post-analysis hook
  // and the billing read actions.
  const linkFlowFiles = [
    "src/app/auth/callback/route.ts",
    "src/app/dashboard/settings/actions.ts",
    "src/components/settings-client.tsx",
  ]
  for (const file of linkFlowFiles) {
    it(`${file} contains no referral writes`, () => {
      const source = readFileSync(join(process.cwd(), file), "utf8")
      expect(source).not.toMatch(/attribute_referral|claim_referral_reward|referral_attributions/)
    })
  }

  it("only the analysis hook and billing actions invoke referral RPCs", () => {
    const allowedCallers = new Set([
      "src/app/audit/[id]/actions.ts",
      "src/app/billing/actions.ts",
    ])
    const hits: string[] = []
    const scan = (dir: string) => {
      const joinPath = join
      for (const entry of readdirSync(join(process.cwd(), dir))) {
        const full = joinPath(process.cwd(), dir, entry)
        if (statSync(full).isDirectory()) {
          if (entry === "node_modules" || entry === ".next") continue
          if (joinPath(dir, entry) === joinPath("src", "lib", "referrals")) continue
          scan(joinPath(dir, entry))
        } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
          const source = readFileSync(full, "utf8")
          if (/rpc\("(attribute_referral|claim_referral_reward|ensure_referral_code)"\)/.test(source)) {
            hits.push(joinPath(dir, entry).replace(/\\/g, "/"))
          }
        }
      }
    }
    scan("src")
    expect(hits.sort()).toEqual(
      ["src/app/audit/[id]/actions.ts", "src/app/billing/actions.ts"].sort()
    )
    expect(allowedCallers.size).toBe(2)
  })
})

describe("referral migration 00033", () => {
  const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "00033_referral_system.sql"), "utf8")

  it("creates both tables with ownership and idempotency guards", () => {
    expect(sql).toMatch(/CREATE TABLE referral_codes/)
    expect(sql).toMatch(/CREATE TABLE referral_attributions/)
    expect(sql).toMatch(/UNIQUE/)
    expect(sql).toMatch(/no_self_referral/)
    expect(sql).toMatch(/referred_user_id UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE UNIQUE/)
  })

  it("enables RLS with no public writes", () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(sql).not.toMatch(/USING \(true\)/)
    expect(sql).toMatch(/claim_referral_reward/)
    expect(sql).toMatch(/SECURITY DEFINER/)
    expect(sql).toMatch(/SET search_path = public/)
  })

  it("keeps the reward server-owned and replay-safe", () => {
    expect(sql).toMatch(/pg_advisory_xact_lock/)
    expect(sql).toMatch(/ON CONFLICT \(user_id, idempotency_key\) DO NOTHING/)
    expect(sql).toMatch(/referral:/)
  })
})
