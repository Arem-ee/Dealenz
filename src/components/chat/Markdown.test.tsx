import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { Markdown } from "./Markdown"

function html(text: string): string {
  return renderToStaticMarkup(<Markdown text={text} />)
}

describe("Markdown safe subset", () => {
  it("renders bold and italic without asterisks leaking", () => {
    const out = html("**What is known:** the role. *Why it matters:* pay.")
    expect(out).toContain("<strong>What is known:</strong>")
    expect(out).toContain("<em>Why it matters:</em>")
    expect(out).not.toContain("**")
  })

  it("renders unordered and ordered lists", () => {
    const out = html("- first\n- second")
    expect(out).toContain("<ul")
    expect(out).toContain("<li>first</li>")
    const ordered = html("1. one\n2. two")
    expect(ordered).toContain("<ol")
    expect(ordered).toContain("<li>one</li>")
  })

  it("renders inline code and headings without heading-tag soup", () => {
    const code = html("Use `net 30` terms.")
    expect(code).toContain("<code")
    expect(code).toContain("net 30")
    const out = html("## Key risk")
    expect(out).not.toContain("##")
    expect(out).toContain("Key risk")
  })

  it("escapes HTML instead of executing it", () => {
    const out = html('Nice <script>alert("x")</script> deal.')
    expect(out).not.toContain("<script>")
    expect(out).toContain("&lt;script&gt;")
  })

  it("leaves unmatched asterisks alone", () => {
    const out = html("A 5 * 3 multiple is fine * really.")
    expect(out).toContain("5 * 3 multiple")
  })

  it("keeps raw URLs as plain text, never links", () => {
    const out = html("See https://example.com/?a=1 for details.")
    expect(out).not.toContain("<a")
    expect(out).toContain("https://example.com/?a=1")
  })

  it("supports nested bold inside list items", () => {
    const out = html("- **Counterparty:** unknown")
    expect(out).toContain("<li><strong>Counterparty:</strong> unknown</li>")
  })
})
