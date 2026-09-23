import { describe, it, expect } from "vitest"
import { sanitizeUserError, errorDigest } from "./sanitize"

describe("sanitizeUserError", () => {
  it("passes curated server messages through untouched", () => {
    expect(sanitizeUserError("Insufficient credits for this operation.")).toBe(
      "Insufficient credits for this operation."
    )
    expect(sanitizeUserError("Dealenz doesn't offer lawyer review. No credits were charged.")).toBe(
      "Dealenz doesn't offer lawyer review. No credits were charged."
    )
  })

  it("replaces minified React internals with the generic fallback", () => {
    expect(
      sanitizeUserError("Minified React error #441; visit https://react.dev/errors/441 for the full message.")
    ).toBe("We couldn't do that. Please try again.")
  })

  it("replaces framework control-flow and hydration internals", () => {
    expect(sanitizeUserError("NEXT_REDIRECT")).toBe("We couldn't do that. Please try again.")
    expect(sanitizeUserError("Error: everything broke digest: 12345")).toBe("We couldn't do that. Please try again.")
    expect(sanitizeUserError("Hydration failed because the server rendered HTML")).toBe(
      "We couldn't do that. Please try again."
    )
  })

  it("falls back on empty, non-string, or absurdly long input", () => {
    expect(sanitizeUserError("")).toBe("We couldn't do that. Please try again.")
    expect(sanitizeUserError("   ")).toBe("We couldn't do that. Please try again.")
    expect(sanitizeUserError(null)).toBe("We couldn't do that. Please try again.")
    expect(sanitizeUserError(undefined)).toBe("We couldn't do that. Please try again.")
    expect(sanitizeUserError("x".repeat(501))).toBe("We couldn't do that. Please try again.")
  })
})

describe("errorDigest", () => {
  it("extracts a string digest and nothing else", () => {
    expect(errorDigest({ digest: "abc123" })).toBe("abc123")
    expect(errorDigest(new Error("boom"))).toBeNull()
    expect(errorDigest(null)).toBeNull()
    expect(errorDigest("digest: abc")).toBeNull()
  })
})
