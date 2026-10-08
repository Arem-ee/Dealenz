import { describe, expect, it } from "vitest"
import { extractPromptVariables, normalizePromptName, renderPromptTemplate } from "./variables"

describe("extractPromptVariables", () => {
  it("returns distinct names in order", () => {
    expect(extractPromptVariables("Hi {{name}}, see {{doc}} and {{name}}")).toEqual(["name", "doc"])
  })

  it("ignores malformed placeholders", () => {
    expect(extractPromptVariables("{{}} {{has space}} {{ok_name}}")).toEqual(["ok_name"])
  })

  it("returns empty for non-strings", () => {
    expect(extractPromptVariables("")).toEqual([])
  })
})

describe("renderPromptTemplate", () => {
  it("renders provided values", () => {
    expect(renderPromptTemplate("Risk in {{doc}}: {{q}}", { doc: "MSA", q: "caps?" })).toEqual({
      ok: true,
      text: "Risk in MSA: caps?",
    })
  })

  it("fails closed listing missing variables", () => {
    const out = renderPromptTemplate("Risk in {{doc}}: {{q}}", { doc: "MSA" })
    expect(out).toEqual({ ok: false, missing: ["q"] })
  })

  it("treats blank values as missing", () => {
    const out = renderPromptTemplate("Hi {{name}}", { name: "   " })
    expect(out.ok).toBe(false)
  })
})

describe("normalizePromptName", () => {
  it("trims and rejects blanks", () => {
    expect(normalizePromptName("  Risk review  ")).toBe("Risk review")
    expect(normalizePromptName("   ")).toBeNull()
    expect(normalizePromptName(42)).toBeNull()
  })
})
