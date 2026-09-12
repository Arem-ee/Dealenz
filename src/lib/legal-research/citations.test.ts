import { describe, it, expect } from "vitest"
import { citationFromSource, validateCitations } from "./citations"
import { NIGERIA_LEGAL_CORPUS } from "./corpus"

describe("legal citations", () => {
  it("citation maps to actual retrieved passage", () => {
    const src = NIGERIA_LEGAL_CORPUS[0]
    const c = citationFromSource(src)
    expect(c.sourceId).toBe(src.id)
    expect(c.url).toBe(src.originalUri)
    // Passage is the excerpt, which is a substring of content (corpus guarantee)
    expect(src.content.includes(c.passage.slice(0, Math.min(30, c.passage.length)))).toBe(true)
    expect(src.excerpt.includes(c.passage.slice(0, 10))).toBe(true)
    expect(validateCitations([c], [src]).valid).toBe(true)
  })

  it("rejects fabricated citation not in source content", () => {
    const src = NIGERIA_LEGAL_CORPUS[0]
    const c = citationFromSource(src)
    const fake = { ...c, passage: "This passage was entirely fabricated and does not exist in the source content at all for testing fabricated citation rejection" }
    expect(validateCitations([fake], [src]).valid).toBe(false)
  })

  it("rejects citation with non-allowlisted URL", () => {
    const src = { ...NIGERIA_LEGAL_CORPUS[0], originalUri: "https://evil.com/law.pdf" }
    const c = citationFromSource(src as never)
    expect(validateCitations([c], [src as never]).valid).toBe(false)
  })

  it("never fabricates citation from model memory — excerpt must be from source", () => {
    const src = NIGERIA_LEGAL_CORPUS[1]
    const c = citationFromSource(src)
    expect(c.passage.length).toBeGreaterThan(10)
    expect(src.excerpt).toContain(c.passage.slice(0, 10))
  })
})
