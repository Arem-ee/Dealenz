import { describe, it, expect, vi, beforeEach } from "vitest"
import { toAnonymousError, ANONYMOUS_ANALYSIS_FAILURE } from "./safe-error"

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
