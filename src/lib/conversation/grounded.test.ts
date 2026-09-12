import { describe, it, expect, vi } from "vitest"
import { answerQuestion } from "./request"
import { seedEnvelopeForDealType, applyUserConfirmation } from "@/lib/context"

function fakeLedger() {
  return {
    rpc: vi.fn(async (fn: string) => {
      if (fn === "credit_balance") return { data: [{ balance: 100 }], error: null }
      if (fn === "reserve_credits") return { data: [{ allowed: true, balance: 97, reservation_id: "res-1" }], error: null }
      if (fn === "finalize_reservation") return { data: [{ balance: 97 }], error: null }
      return { data: null, error: null }
    }),
  } as never
}

function ports(overrides: Partial<Parameters<typeof answerQuestion>[0]["ports"]> = {}) {
  return {
    loadContext: async () => null,
    loadFacts: async () => null,
    loadKnowledge: async () => [],
    aiCaller: async ({ userContent }: { systemPrompt: string; userContent: string; maxTokens: number }) => {
      // Echo the legal block if present, else generic answer
      const hasLegal = userContent.includes("Legal sources")
      const text = hasLegal ? "Based on verified sources: CAMA 2020 Section 18 — A company may be incorporated..." : "General answer without legal research."
      return { text, usage: undefined, provider: "test", model: "test-model" }
    },
    ledger: fakeLedger(),
    policy: { estimateMaxCredits: () => 3, creditsForUsage: () => 3 } as never,
    ...overrides,
  } as never
}

describe("Ask grounded research integration (Phase 27)", () => {
  it("ordinary deal question does not invoke research", async () => {
    const p = ports()
    const res = await answerQuestion({ text: "What does net 30 mean?", userId: "u1", ports: p, idempotencyKey: "k1" })
    expect(res.type).toBe("answer")
    if (res.type !== "answer") throw new Error("unreachable")
    expect(res.researchState).toBeNull()
    expect(res.legalCitations).toEqual([])
  })

  it("legal question invokes research and returns citations", async () => {
    // Provide a Nigerian context so research can match
    const envelope = applyUserConfirmation(seedEnvelopeForDealType("founder"), { jurisdiction: { value: "Nigeria" } } as never)
    const p = ports({
      loadContext: async () => envelope,
      loadFacts: async () => ({
        extracted: { goals: ["founder"], deliverables: [], timeline: null, budget: null, projectType: null, clientSignals: [], missingInformation: [], confidence: 0.9 },
        rawText: "founder deal",
      }),
      loadKnowledge: async () => [],
    })
    const res = await answerQuestion({ text: "What does CAMA say about share transfer in Nigeria?", userId: "u1", ports: p, idempotencyKey: "k2" })
    expect(res.type).toBe("answer")
    if (res.type !== "answer") throw new Error("unreachable")
    expect(["VERIFIED", "SUPPORTED"]).toContain(res.researchState)
    expect(res.legalCitations.length).toBeGreaterThan(0)
    // Citations must be allowlisted and contain a passage
    for (const c of res.legalCitations) {
      expect(c.url).toMatch(/^https:\/\//)
      expect(c.passage.length).toBeGreaterThan(10)
    }
  })

  it("insufficient evidence produces NOT_FOUND honest uncertainty", async () => {
    const p = ports()
    // NDPA/GDPR is not in the Nigeria CAMA/partnership corpus (which covers
    // incorporation, share transfer, LLP nature, business names, contributions).
    // A query with only the generic "Nigeria" token and no topic overlap stays
    // below the relevance threshold and is honestly NOT_FOUND.
    const res = await answerQuestion({ text: "NDPA GDPR Nigeria data protection?", userId: "u1", ports: p, idempotencyKey: "k3" })
    expect(res.type).toBe("answer")
    if (res.type !== "answer") throw new Error("unreachable")
    expect(res.researchState).toBe("NOT_FOUND")
    expect(res.legalCitations).toEqual([])
    expect(res.legalLimitations).toMatch(/No authoritative source matched/i)

    const p2 = ports()
    const res2 = await answerQuestion({ text: "quantum banana philosophy astrophysics", userId: "u1", ports: p2, idempotencyKey: "k4" })
    expect(res2.type).toBe("answer")
    if (res2.type !== "answer") throw new Error("unreachable")
    // Non-legal nonsense should not invoke research at all
    expect(res2.researchState).toBeNull()
  })

  it("unsupported jurisdiction is handled honestly (NOT_FOUND with limitation)", async () => {
    const { performResearch } = await import("@/lib/legal-research/research")
    const { INTERNATIONAL_LEGAL_CORPUS } = await import("@/lib/legal-research/corpus")
    // Germany now has Tier 2 foundation coverage (BGB sale/lease/employment)
    const deResult = await performResearch(
      { text: "German sale lease employment", jurisdiction: { scope: "country", country: "Germany", region: null }, dealType: "purchase_sale" },
      { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS }
    )
    expect(["VERIFIED", "SUPPORTED"]).toContain(deResult.state)
    expect(deResult.citations[0].url).toContain("gesetze-im-internet.de")
    // A jurisdiction with no verified coverage stays honestly NOT_FOUND
    const caResult = await performResearch(
      { text: "Canadian sale lease employment", jurisdiction: { scope: "country", country: "Canada", region: null }, dealType: "purchase_sale" },
      { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS }
    )
    expect(caResult.state).toBe("NOT_FOUND")
    expect(caResult.limitations).toMatch(/not yet supported/i)
    // UK is now supported — a UK transfer question should be VERIFIED with UK corpus
    const ukResult = await performResearch(
      { text: "UK transfer shares", jurisdiction: { scope: "territory", country: "United Kingdom", region: "England and Wales" }, dealType: "founder" },
      { adapter: null, corpus: INTERNATIONAL_LEGAL_CORPUS }
    )
    expect(["VERIFIED", "SUPPORTED"]).toContain(ukResult.state)
    expect(ukResult.citations.length).toBeGreaterThan(0)
  })

  it("unknown jurisdiction asks instead of guessing (NEEDS_JURISDICTION)", async () => {
    const p = ports()
    // Legally material question ("is this enforceable") with no jurisdiction anywhere
    const res = await answerQuestion({ text: "Is this vesting schedule legally enforceable?", userId: "u1", ports: p, idempotencyKey: "k5" })
    expect(res.type).toBe("answer")
    if (res.type !== "answer") throw new Error("unreachable")
    expect(res.researchState).toBe("NEEDS_JURISDICTION")
    expect(res.legalCitations).toEqual([])
    expect(res.legalLimitations).toMatch(/jurisdiction/i)
    expect(res.requiresLawyerReview).toBe(false)
  })

  it("greeting never invokes research", async () => {
    const p = ports({ aiCaller: async () => { throw new Error("must not be called") } })
    const res = await answerQuestion({ text: "Hello", userId: "u1", ports: p })
    expect(res.type).toBe("answer")
    if (res.type !== "answer") throw new Error("unreachable")
    expect(res.deterministic).toBe(true)
    expect(res.researchState).toBeNull()
  })
})
