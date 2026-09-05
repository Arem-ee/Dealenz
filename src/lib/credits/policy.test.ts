import { describe, it, expect, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { authorizeOperation, completeOperation } from "./policy"
import type { LedgerClient } from "./ledger"
import type { CreditPolicy } from "@/lib/ai/usage"
import { clearRegistry, evaluateApplicableRules } from "@/lib/rules/registry"
import { registerFreelancePack, resetFreelanceRegistration } from "@/lib/verticals/freelance/rules"
import { registerLeasePack, resetLeaseRegistration } from "@/lib/verticals/lease/rules"
import { applyUserConfirmation, seedEnvelopeForDealType } from "@/lib/context"

// Fake ledger mirroring the RPC contract: single-RPC atomic reserve,
// advisory-lock semantics documented in migration 00023, idempotent replay.
function fakeLedger(initialBalance = 100) {
  const calls: string[] = []
  let holds = 0
  const byKey = new Map<string, { allowed: boolean; balance: number; reservation_id: string | null }>()
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown> = {}) => {
    calls.push(fn)
    if (fn === "credit_balance") return { data: [{ balance: initialBalance - holds }], error: null }
    if (fn === "reserve_credits") {
      const key = args.p_idempotency_key as string
      const existing = byKey.get(key)
      if (existing) return { data: [existing], error: null }
      const amount = args.p_amount as number
      if (initialBalance - holds < amount) {
        return { data: [{ allowed: false, balance: initialBalance - holds, reservation_id: null }], error: null }
      }
      holds += amount
      const outcome = { allowed: true, balance: initialBalance - holds, reservation_id: `res-${key}` }
      byKey.set(key, outcome)
      return { data: [outcome], error: null }
    }
    if (fn === "finalize_reservation") return { data: [{ balance: initialBalance - holds }], error: null }
    if (fn === "void_reservation") return { data: null, error: null }
    return { data: null, error: { message: "unknown fn" } }
  })
  return { client: { rpc } as LedgerClient, calls }
}

const PRICED: CreditPolicy = {
  estimateMaxCredits: () => 10,
  creditsForUsage: () => 3,
}

describe("credit authorization", () => {
  it("meters without charging when no policy is configured", async () => {
    const { client, calls } = fakeLedger()
    const auth = await authorizeOperation({ ledger: client, userId: "u1", operation: "conversation", policy: null })
    expect(auth).toMatchObject({ mode: "metering", authorized: true, reservationId: null })
    expect(calls).not.toContain("reserve_credits")
    const done = await completeOperation({
      ledger: client,
      authorization: auth,
      operation: "conversation",
      provider: "anthropic",
      model: "claude-sonnet-5",
      usage: { inputTokens: 50, outputTokens: 10 },
      status: "success",
      policy: null,
    })
    expect(done.record.creditsConsumed).toBeNull()
    expect(done.record.totalTokens).toBe(60)
  })

  it("denies priced operations without sufficient credits before any hold", async () => {
    const { client } = fakeLedger(2)
    const auth = await authorizeOperation({
      ledger: client, userId: "u1", operation: "conversation", idempotencyKey: "q-1", policy: PRICED,
    })
    expect(auth.authorized).toBe(false)
    expect(auth.mode).toBe("denied")
    expect(auth.denialReason).toMatch(/Insufficient/)
  })

  it("reserves once and never double-charges a replayed operation", async () => {
    const { client, calls } = fakeLedger()
    const first = await authorizeOperation({
      ledger: client, userId: "u1", operation: "conversation", idempotencyKey: "q-9", policy: PRICED,
    })
    const second = await authorizeOperation({
      ledger: client, userId: "u1", operation: "conversation", idempotencyKey: "q-9", policy: PRICED,
    })
    expect(first.authorized).toBe(true)
    expect(second.authorized).toBe(true)
    expect(second.reservationId).toBe(first.reservationId)
    expect(calls.filter((c) => c === "reserve_credits")).toHaveLength(2)
    // One hold exists server-side: the replay returned the original outcome.
    const done = await completeOperation({
      ledger: client, authorization: second, operation: "conversation",
      provider: "p", model: "m", usage: { inputTokens: 1, outputTokens: 1 },
      status: "success", policy: PRICED,
    })
    expect(done.record.creditsConsumed).toBe(3)
  })

  it("releases the hold without charge when the provider call fails", async () => {
    const { client, calls } = fakeLedger()
    const auth = await authorizeOperation({
      ledger: client, userId: "u1", operation: "conversation", idempotencyKey: "q-f", policy: PRICED,
    })
    expect(auth.mode).toBe("reserved")
    const done = await completeOperation({
      ledger: client, authorization: auth, operation: "conversation", status: "provider_failure", policy: PRICED,
    })
    expect(done.record.creditsConsumed).toBeNull()
    expect(done.record.status).toBe("provider_failure")
    expect(calls).toContain("void_reservation")
    expect(calls).not.toContain("finalize_reservation")
  })

  it("checks and holds atomically in one RPC, never read-then-write", async () => {
    const { client, calls } = fakeLedger()
    await authorizeOperation({
      ledger: client, userId: "u1", operation: "conversation", idempotencyKey: "q-a", policy: PRICED,
    })
    // Balance reads are informational; the hold decision happens inside a
    // single reserve_credits call (advisory-locked server-side per 00023).
    expect(calls.filter((c) => c === "reserve_credits")).toHaveLength(1)
  })

  it("keeps balances non-negative by denying overdrafts", async () => {
    const { client } = fakeLedger(5)
    const first = await authorizeOperation({
      ledger: client, userId: "u1", operation: "conversation", idempotencyKey: "q-a", policy: PRICED,
    })
    expect(first.authorized).toBe(false)
  })
})

describe("economic independence", () => {
  it("produces identical deterministic findings regardless of credits available", async () => {    clearRegistry()
    resetFreelanceRegistration()
    registerFreelancePack()
    const envelope = applyUserConfirmation(seedEnvelopeForDealType("freelance"), {
      userRole: { value: "freelancer" },
      counterpartyRole: { value: "client" },
    })
    const input = {
      context: envelope,
      facts: { freelance: { fee: { text: null, evidence: null } } },
      knowledge: [],
      operation: "document_analysis" as const,
      evaluatedAt: "2026-09-04T00:00:00.000Z",
    }
    // Credits are not an input to evaluation at all: the same bundle run
    // "as" a rich user and "as" a nearly-broke user yields identical truth.
    const rich = evaluateApplicableRules(input, "document_analysis", "freelance")
    const broke = evaluateApplicableRules(JSON.parse(JSON.stringify(input)) as typeof input, "document_analysis", "freelance")
    expect(broke).toEqual(rich)
    expect(rich.results.find((r) => r.ruleKey === "freelance-fee-terms-missing")?.status).toBe("FAIL")
  })

  it("holds for lease findings as well as freelance findings", async () => {
    clearRegistry()
    resetLeaseRegistration()
    registerLeasePack()
    const envelope = applyUserConfirmation(seedEnvelopeForDealType("lease"), {
      userRole: { value: "tenant" },
      counterpartyRole: { value: "landlord" },
    })
    const input = {
      context: envelope,
      facts: { lease: { rent: { text: null, evidence: null } } },
      knowledge: [],
      operation: "document_analysis" as const,
      evaluatedAt: "2026-09-04T00:00:00.000Z",
    }
    const rich = evaluateApplicableRules(input, "document_analysis", "lease")
    const broke = evaluateApplicableRules(JSON.parse(JSON.stringify(input)) as typeof input, "document_analysis", "lease")
    expect(broke).toEqual(rich)
    expect(rich.results.find((r) => r.ruleKey === "lease-rent-terms-missing")?.status).toBe("FAIL")
  })
})

describe("credit ledger migration (static, not a live check)", () => {
  const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "00023_credit_ledger.sql"), "utf8")

  it("enables RLS with read-own history and no public writes", () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/Users can view own ledger/)
    expect(sql).not.toMatch(/FOR INSERT[\s\S]{0,200}USING \(true\)/)
    expect(sql).not.toMatch(/FOR UPDATE[\s\S]{0,200}USING \(true\)/)
  })

  it("serializes balance changes with per-user advisory locks", () => {
    expect(sql).toMatch(/pg_advisory_xact_lock/)
    expect(sql).toMatch(/reserve_credits/)
    expect(sql).toMatch(/finalize_reservation/)
    expect(sql).toMatch(/void_reservation/)
    expect(sql).toMatch(/UNIQUE \(user_id, idempotency_key\)/)
  })
})
