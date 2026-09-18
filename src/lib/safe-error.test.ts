import { describe, it, expect } from "vitest"
import { publicErrorMessage } from "./safe-error"

describe("publicErrorMessage", () => {
  const FALLBACK = "Analysis failed. Please try again."

  it("collapses provider failures to the curated fallback", () => {
    expect(publicErrorMessage(new Error("Gemini request failed - HTTP 500"), FALLBACK)).toBe(FALLBACK)
    expect(publicErrorMessage(new Error("No JSON object found in Gemini response"), FALLBACK)).toBe(FALLBACK)
    expect(publicErrorMessage(new Error("Anthropic quota exceeded"), FALLBACK)).toBe(FALLBACK)
    expect(publicErrorMessage(new Error("fetch failed"), FALLBACK)).toBe(FALLBACK)
    expect(publicErrorMessage(new Error("Request failed with status 503"), FALLBACK)).toBe(FALLBACK)
  })

  it("passes curated product errors through verbatim", () => {
    expect(
      publicErrorMessage(new Error("That doesn't look like a deal yet. Add more detail."), FALLBACK)
    ).toBe("That doesn't look like a deal yet. Add more detail.")
    expect(publicErrorMessage(new Error("Deal not found."), FALLBACK)).toBe("Deal not found.")
    expect(
      publicErrorMessage(new Error("You must consent to AI analysis before proceeding."), FALLBACK)
    ).toBe("You must consent to AI analysis before proceeding.")
  })

  it("falls back on empty or non-Error values", () => {
    expect(publicErrorMessage(new Error(""), FALLBACK)).toBe(FALLBACK)
    expect(publicErrorMessage(null, FALLBACK)).toBe(FALLBACK)
    expect(publicErrorMessage(undefined, FALLBACK)).toBe(FALLBACK)
  })
})
