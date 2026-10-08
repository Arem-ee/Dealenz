import { describe, expect, it } from "vitest"
import { evaluateClauseRound, isNegotiationStance, type ClauseRoundInput } from "./round"

function input(over: Partial<ClauseRoundInput> = {}): ClauseRoundInput {
  return {
    clauseId: "c1",
    currentText: "Pay net 30.",
    preferredBody: "Pay net 30.",
    preferredVersion: 2,
    fallbacks: [{ rung: 1, variant: "fallback", body: "Pay net 45." }],
    walkawayBody: "Never accept net-60.",
    alreadyOfferedRungs: [],
    insertOnMissing: false,
    stance: "balanced",
    ...over,
  }
}

describe("evaluateClauseRound", () => {
  it("accepts preferred matches", () => {
    const out = evaluateClauseRound(input())
    expect(out.outcome).toBe("accept")
    expect(out.variant).toBe("preferred")
  })

  it("holds already-reached fallback rungs", () => {
    const out = evaluateClauseRound(input({ currentText: "Pay net 45." }))
    expect(out).toMatchObject({ outcome: "accept", variant: "fallback", rung: 1 })
  })

  it("proposes the first unoffered rung", () => {
    const out = evaluateClauseRound(input({ currentText: "Pay on receipt." }))
    expect(out).toMatchObject({ outcome: "fallback", rung: 1, offeredBody: "Pay net 45." })
  })

  it("skips already-offered rungs, then escalates past walk-away", () => {
    const out = evaluateClauseRound(input({ currentText: "Pay on receipt.", alreadyOfferedRungs: [1] }))
    expect(out).toMatchObject({ outcome: "escalate", variant: "walkaway" })
  })

  it("routes when no ladder exists", () => {
    const out = evaluateClauseRound(input({ currentText: "Pay on receipt.", fallbacks: [], walkawayBody: null }))
    expect(out.outcome).toBe("route")
  })

  it("proposes insertion for missing clauses with silence cover", () => {
    const out = evaluateClauseRound(input({ currentText: null, insertOnMissing: true }))
    expect(out).toMatchObject({ outcome: "fallback", variant: "preferred" })
  })

  it("routes missing clauses without cover, and light stance holds concessions", () => {
    expect(evaluateClauseRound(input({ currentText: null })).outcome).toBe("route")
    expect(evaluateClauseRound(input({ currentText: "Pay on receipt.", stance: "light" })).outcome).toBe("route")
  })

  it("validates stances", () => {
    expect(isNegotiationStance("firm")).toBe(true)
    expect(isNegotiationStance("aggressive")).toBe(false)
  })
})
