import { describe, expect, it } from "vitest"
import { buildAskPrompt, parseClaimsBlock } from "./claims"

describe("parseClaimsBlock", () => {
  it("extracts verdict claims and strips the block", () => {
    const parsed = parseClaimsBlock("You should push back.\n[[CLAIMS payment-risk:FAIL, budget-missing:PASS]]")
    expect(parsed.claims).toEqual([
      { ruleKey: "payment-risk", assertedStatus: "FAIL" },
      { ruleKey: "budget-missing", assertedStatus: "PASS" },
    ])
    expect(parsed.clean).toBe("You should push back.")
  })

  it("treats none and missing blocks as no claims", () => {
    expect(parseClaimsBlock("Plain answer.").claims).toEqual([])
    expect(parseClaimsBlock("Plain answer.").clean).toBe("Plain answer.")
    const none = parseClaimsBlock("Answer.\n[[CLAIMS none]]")
    expect(none.claims).toEqual([])
    expect(none.clean).toBe("Answer.")
  })

  it("drops malformed claim parts", () => {
    const parsed = parseClaimsBlock("Answer.\n[[CLAIMS bogus, ok:MAYBE, good:fail]]")
    expect(parsed.claims).toEqual([{ ruleKey: "good", assertedStatus: "FAIL" }])
  })
})

describe("buildAskPrompt", () => {
  it("grounds the question in findings and material only", () => {
    const { systemPrompt, userContent } = buildAskPrompt({
      question: "Should I sign?",
      dealType: "freelance",
      material: "Payment net 60.",
      findings: [
        { ruleKey: "payment-risk", status: "FAIL", severity: "material", summary: "Late payment.", guidance: "Ask for net 30.", evidenceQuote: "net 60" },
      ],
      history: [{ role: "user", text: "Hi" }],
    })
    expect(systemPrompt).toContain("Never contradict a deterministic finding")
    expect(systemPrompt).toContain("[[CLAIMS")
    expect(userContent).toContain("Payment net 60.")
    expect(userContent).toContain("payment-risk")
    expect(userContent).toContain("Should I sign?")
  })
})
