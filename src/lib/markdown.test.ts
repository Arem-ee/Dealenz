import { describe, it, expect } from "vitest"
import { parseMarkdown } from "./markdown"

describe("parseMarkdown", () => {
  it("parses {{var}} blanks as var nodes, never dropped", () => {
    const blocks = parseMarkdown("Payment due {{payment_date}}.")
    expect(blocks).toHaveLength(1)
    const first = blocks[0]
    if (first.type !== "paragraph") throw new Error("unreachable")
    expect(first.children).toContainEqual({ type: "var", name: "payment_date" })
    expect(first.children.some((n) => n.type === "text" && n.text.includes("{{"))).toBe(false)
  })

  it("keeps bold parsing alongside vars", () => {
    const blocks = parseMarkdown("**Total**: {{amount}} due now.")
    const first = blocks[0]
    if (first.type !== "paragraph") throw new Error("unreachable")
    expect(first.children).toContainEqual({ type: "bold", text: "Total" })
    expect(first.children).toContainEqual({ type: "var", name: "amount" })
  })

  it("distinguishes ordered from unordered lists", () => {
    const ordered = parseMarkdown("1. First\n2. Second")
    expect(ordered[0].type).toBe("list")
    if (ordered[0].type !== "list") throw new Error("unreachable")
    expect(ordered[0].ordered).toBe(true)
    const plain = parseMarkdown("- a\n- b")
    if (plain[0].type !== "list") throw new Error("unreachable")
    expect(plain[0].ordered).toBe(false)
  })

  it("parses pipe tables with headers, alignment, and rows", () => {
    const blocks = parseMarkdown("| Item | Price |\n| --- | ---: |\n| Homepage | $500 |\n| Contact page | $250 |")
    expect(blocks).toHaveLength(1)
    const table = blocks[0]
    if (table.type !== "table") throw new Error("unreachable")
    expect(table.headers).toHaveLength(2)
    expect(table.aligns).toEqual(["left", "right"])
    expect(table.rows).toHaveLength(2)
    expect(table.rows[0][1]).toContainEqual({ type: "text", text: "$500" })
  })

  it("leaves lone pipe lines as paragraphs", () => {
    const blocks = parseMarkdown("Pay 50 | 50 on delivery.")
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe("paragraph")
  })

  it("normalizes ragged rows to the header width", () => {
    const blocks = parseMarkdown("| A | B | C |\n| --- | --- | --- |\n| x |")
    const table = blocks[0]
    if (table.type !== "table") throw new Error("unreachable")
    expect(table.rows[0]).toHaveLength(3)
  })
})
