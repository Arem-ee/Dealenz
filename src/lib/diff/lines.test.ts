import { describe, it, expect } from "vitest"
import { diffLines } from "./lines"

describe("diffLines", () => {
  it("marks identical texts all same", () => {
    const out = diffLines("a\nb", "a\nb")
    expect(out).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
    ])
  })

  it("detects additions, deletions, and replacements", () => {
    const out = diffLines("a\nb\nc", "a\nB\nc\nd")
    expect(out).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "B" },
      { type: "same", text: "c" },
      { type: "add", text: "d" },
    ])
  })

  it("handles empty old text as all additions", () => {
    expect(diffLines("", "x")).toEqual([
      { type: "del", text: "" },
      { type: "add", text: "x" },
    ])
  })

  it("refuses oversized documents instead of hanging", () => {
    const big = Array.from({ length: 501 }, (_, i) => `line ${i}`).join("\n")
    expect(diffLines(big, "small")).toBeNull()
    expect(diffLines("small", big)).toBeNull()
  })
})
