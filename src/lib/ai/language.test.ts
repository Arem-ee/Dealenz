import { describe, expect, it } from "vitest"
import { responseLanguageInstruction, responseLanguageName } from "./language"

describe("responseLanguageInstruction", () => {
  it("is empty for English and unknown locales", () => {
    expect(responseLanguageInstruction("en")).toBe("")
    expect(responseLanguageInstruction("es")).toBe("")
    expect(responseLanguageInstruction(null)).toBe("")
  })

  it("instructs French/German prose with English evidence preserved", () => {
    const fr = responseLanguageInstruction("fr")
    expect(fr).toContain("French")
    expect(fr).toContain("original English")
    expect(responseLanguageInstruction("de")).toContain("German")
  })

  it("names locales", () => {
    expect(responseLanguageName("de")).toBe("German")
  })
})
