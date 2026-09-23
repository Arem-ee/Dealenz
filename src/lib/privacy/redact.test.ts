import { describe, it, expect } from "vitest"
import { findSensitiveSpans, applyRedactions, redactLabel } from "./redact"

describe("findSensitiveSpans", () => {
  it("finds emails and phone numbers", () => {
    const spans = findSensitiveSpans("Call me at +1 (555) 123-4567 or jane.doe@example.com ok?")
    expect(spans.map((s) => s.kind).sort()).toEqual(["email", "phone"])
    const email = spans.find((s) => s.kind === "email")!
    expect(email.value).toBe("jane.doe@example.com")
  })

  it("never matches years, amounts, or clause numbers", () => {
    expect(findSensitiveSpans("Signed in 2026 for $5,000, see clause 4.2 and section 12.")).toEqual([])
    expect(findSensitiveSpans("Total: 1,000,000 USD.")).toEqual([])
  })

  it("matches caller-supplied terms case-insensitively", () => {
    const spans = findSensitiveSpans("Payable to Acme Holdings Ltd on Friday.", ["acme holdings ltd"])
    expect(spans).toHaveLength(1)
    expect(spans[0].kind).toBe("custom")
    expect(spans[0].value).toBe("Acme Holdings Ltd")
  })

  it("ignores junk custom terms and caps runaway matches", () => {
    expect(findSensitiveSpans("hello world", ["", "x", "  "])).toEqual([])
    const many = findSensitiveSpans("a ".repeat(500), ["a"])
    expect(many.length).toBeLessThanOrEqual(200)
  })

  it("returns spans in document order", () => {
    const spans = findSensitiveSpans("bob@example.com then 555-123-4567")
    expect(spans[0].kind).toBe("email")
    expect(spans[1].kind).toBe("phone")
  })
})

describe("applyRedactions", () => {
  it("masks spans with per-kind numbered labels", () => {
    const text = "Email jane.doe@example.com or bob@example.com, or call 555-123-4567."
    const { text: out, count } = applyRedactions(text, findSensitiveSpans(text))
    expect(count).toBe(3)
    expect(out).toContain("[email 1]")
    expect(out).toContain("[email 2]")
    expect(out).toContain("[phone 1]")
    expect(out).not.toContain("jane.doe@example.com")
  })

  it("is a no-op on empty span lists", () => {
    expect(applyRedactions("plain text", [])).toEqual({ text: "plain text", count: 0 })
  })

  it("labels kinds predictably", () => {
    expect(redactLabel("email", 1)).toBe("[email 1]")
    expect(redactLabel("custom", 3)).toBe("[custom 3]")
  })
})
