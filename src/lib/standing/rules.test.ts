import { describe, it, expect } from "vitest"
import {
  formatStandingBlock,
  MAX_STANDING_RULES,
  MAX_RULE_CHARS,
  STANDING_BLOCK_BUDGET_CHARS,
} from "./rules"

describe("formatStandingBlock", () => {
  it("returns null for empty input (absent stays absent)", () => {
    expect(formatStandingBlock([])).toBeNull()
    expect(formatStandingBlock(["  ", ""])).toBeNull()
  })

  it("formats rules as a headed bullet block", () => {
    const block = formatStandingBlock(["I never accept net-60", "Always flag uncapped liability"])
    expect(block).toContain("Standing client rules")
    expect(block).toContain("- I never accept net-60")
    expect(block).toContain("- Always flag uncapped liability")
  })

  it("caps rows at the maximum, oldest first", () => {
    const rules = Array.from({ length: MAX_STANDING_RULES + 5 }, (_, i) => `Rule ${i + 1}`)
    const block = formatStandingBlock(rules)
    expect(block).toContain("Rule 1")
    expect(block).toContain(`Rule ${MAX_STANDING_RULES}`)
    expect(block).not.toContain(`Rule ${MAX_STANDING_RULES + 1}`)
  })

  it("clips overlong rules to the character cap", () => {
    const block = formatStandingBlock(["x".repeat(MAX_RULE_CHARS + 50)])
    expect(block!.length).toBeLessThanOrEqual(
      "Standing client rules (apply to this deal alongside the task above):\n".length + MAX_RULE_CHARS + 2
    )
  })

  it("holds the whole block within budget", () => {
    const rules = Array.from({ length: MAX_STANDING_RULES }, () => "y".repeat(300))
    const block = formatStandingBlock(rules)
    expect(block!.length).toBeLessThanOrEqual(STANDING_BLOCK_BUDGET_CHARS + 100)
  })
})
