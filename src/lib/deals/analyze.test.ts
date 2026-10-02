import { describe, expect, it } from "vitest"
import { analyzeDeterministic, summarizeAnalysis } from "./analyze"

const NOW = "2026-10-03T00:00:00.000Z"
const AUDIT = "00000000-0000-0000-0000-0000000000aa"

describe("analyzeDeterministic", () => {
  it("fires deterministic FAILs on risky freelance terms", () => {
    const out = analyzeDeterministic(
      "freelance",
      "The client pays $5,000 net 60. The freelancer accepts unlimited liability without cap and unlimited revisions.",
      AUDIT,
      NOW
    )
    expect(out.fails.length).toBeGreaterThan(0)
    expect(out.evaluatedAt).toBe(NOW)
    for (const f of out.fails) {
      expect(f.finding?.summary).toBeTruthy()
    }
  })

  it("flags missing protections even in benign text", () => {
    const out = analyzeDeterministic("generic", "We met for coffee and talked about the weather.", AUDIT, NOW)
    expect(out.fails.length).toBeGreaterThan(0)
    expect(out.fails.every((f) => f.finding?.summary)).toBe(true)
  })

  it("falls back to generic for unknown deal types", () => {
    const out = analyzeDeterministic("nonsense", "Payment due on receipt without cap.", AUDIT, NOW)
    expect(out.results.length).toBeGreaterThan(0)
  })

  it("is deterministic across runs", () => {
    const text = "Liability is uncapped. Payment net 90."
    const a = analyzeDeterministic("freelance", text, AUDIT, NOW)
    const b = analyzeDeterministic("freelance", text, AUDIT, NOW)
    expect(a).toEqual(b)
  })

  it("summarizes counts honestly", () => {
    expect(summarizeAnalysis({ results: [], fails: [], unknowns: [], evaluatedAt: NOW })).toContain("no risky patterns")
    const out = analyzeDeterministic("freelance", "Liability is uncapped without limit.", AUDIT, NOW)
    expect(summarizeAnalysis(out)).toContain("Analysis complete:")
  })
})
