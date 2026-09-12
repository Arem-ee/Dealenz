import { describe, it, expect, vi, beforeEach } from "vitest"
import { toAnonymousError, ANONYMOUS_ANALYSIS_FAILURE, publicErrorMessage } from "./safe-error"

describe("toAnonymousError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("returns the fixed public message for provider-style errors", () => {
    const result = toAnonymousError(new Error("Gemini request failed — HTTP 500"))
    expect(result.publicMessage).toBe(ANONYMOUS_ANALYSIS_FAILURE)
  })

  it("never includes input text in the public message", () => {
    const dealText = "ACME Corp confidential merger terms worth $10M"
    const result = toAnonymousError(new Error(`parse failed on: ${dealText}`))
    expect(result.publicMessage).not.toContain("ACME")
    expect(result.publicMessage).not.toContain("$10M")
    expect(result.publicMessage).toBe(ANONYMOUS_ANALYSIS_FAILURE)
  })

  it("returns the fixed public message for non-Error values", () => {
    expect(toAnonymousError("some string").publicMessage).toBe(ANONYMOUS_ANALYSIS_FAILURE)
    expect(toAnonymousError(undefined).publicMessage).toBe(ANONYMOUS_ANALYSIS_FAILURE)
    expect(toAnonymousError(null).publicMessage).toBe(ANONYMOUS_ANALYSIS_FAILURE)
  })

  it("logs only the error class server-side, never the message", () => {
    const spy = vi.mocked(console.error)
    toAnonymousError(new Error("secret deal contents here"))
    expect(spy).toHaveBeenCalledWith("[analyze-anonymous] failure:", "Error")
    const logged = spy.mock.calls.map((c) => String(c)).join(" ")
    expect(logged).not.toContain("secret deal contents")
  })
})

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
