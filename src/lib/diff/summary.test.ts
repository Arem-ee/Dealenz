import { describe, expect, it } from "vitest"
import { summarizeDiff } from "./summary"

describe("summarizeDiff", () => {
  it("calls identical documents identical", () => {
    const out = summarizeDiff([{ type: "same", text: "a" }, { type: "same", text: "b" }])
    expect(out.verdict).toBe("Identical")
    expect(out.changedPct).toBe(0)
  })

  it("flags small edits as minor", () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({ type: "same" as const, text: `l${i}` }))
    const out = summarizeDiff([...lines, { type: "add", text: "new" }])
    expect(out.verdict).toBe("Minor edits")
    expect(out.additions).toBe(1)
  })

  it("flags large rewrites as material", () => {
    const out = summarizeDiff([
      { type: "del", text: "old" },
      { type: "add", text: "new" },
      { type: "same", text: "kept" },
    ])
    expect(out.verdict).toBe("Material differences")
    expect(out.changedPct).toBe(67)
  })

  it("handles empty input", () => {
    expect(summarizeDiff([]).verdict).toBe("Identical")
  })
})
