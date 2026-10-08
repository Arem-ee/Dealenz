import { describe, expect, it } from "vitest"
import { checkLinkStructure, orderLinks, type PairingLink } from "./links"

function link(over: Partial<PairingLink> & { variant: PairingLink["variant"] }): PairingLink {
  return {
    libraryKey: "k", rung: 0, conditionText: "", escalate: false, insertOnMissing: false, ...over,
  }
}

describe("orderLinks", () => {
  it("orders preferred, fallbacks by rung, walkaway last", () => {
    const out = orderLinks([
      link({ variant: "walkaway" }),
      link({ variant: "fallback", rung: 2 }),
      link({ variant: "fallback", rung: 1 }),
      link({ variant: "preferred" }),
    ])
    expect(out.map((l) => [l.variant, l.rung])).toEqual([
      ["preferred", 0],
      ["fallback", 1],
      ["fallback", 2],
      ["walkaway", 0],
    ])
  })
})

describe("checkLinkStructure", () => {
  it("stays silent on complete pairings", () => {
    expect(
      checkLinkStructure([
        link({ variant: "preferred" }),
        link({ variant: "fallback", rung: 1, conditionText: "Offer when counterparty pushes on term." }),
        link({ variant: "walkaway" }),
      ])
    ).toEqual([])
  })

  it("warns on missing preferred, condition-less fallback, missing walkaway", () => {
    const codes = checkLinkStructure([link({ variant: "fallback", rung: 1 })]).map((w) => w.code)
    expect(codes).toContain("missing_preferred")
    expect(codes).toContain("conditionless_fallback")
    expect(codes).toContain("missing_walkaway")
  })

  it("warns on escalation without a floor", () => {
    const codes = checkLinkStructure([
      link({ variant: "preferred" }),
      link({ variant: "fallback", rung: 1, conditionText: "When asked.", escalate: true }),
    ]).map((w) => w.code)
    expect(codes).toContain("escalate_without_ladder")
  })

  it("ignores empty pairings", () => {
    expect(checkLinkStructure([])).toEqual([])
  })
})
