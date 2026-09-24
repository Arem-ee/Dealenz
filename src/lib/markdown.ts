import React from "react"

// Shared document AST: screen (renderMarkdown) and PDF
// (src/lib/documents/pdf.tsx) render from this one parse, so the artifact a
// user reads and the file they download cannot drift apart.
export type InlineNode = { type: "text"; text: string } | { type: "bold"; text: string } | { type: "var"; name: string }

export interface BlockQuote {
  type: "quote"
  children: Block[]
}

export interface BlockHeading {
  type: "heading"
  level: number
  children: InlineNode[]
}

export interface BlockParagraph {
  type: "paragraph"
  children: InlineNode[]
}

export interface BlockList {
  type: "list"
  ordered: boolean
  items: InlineNode[][]
}

export type TableAlign = "left" | "center" | "right"

export interface BlockTable {
  type: "table"
  headers: InlineNode[][]
  aligns: TableAlign[]
  rows: InlineNode[][][]
}

export interface BlockHr {
  type: "hr"
}

export type Block = BlockQuote | BlockHeading | BlockParagraph | BlockList | BlockTable | BlockHr

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = []
  // {{var}} blanks render as visible "to complete" pills, never silently
  // dropped: split them out before bold parsing.
  const varParts = text.split(/(\{\{[^}]+\}\})/)
  for (const varPart of varParts) {
    const varMatch = /^\{\{([^}]+)\}\}$/.exec(varPart)
    if (varMatch) {
      nodes.push({ type: "var", name: varMatch[1].trim() })
      continue
    }
    const parts = varPart.split(/(\*\*.*?\*\*)/)
    for (const part of parts) {
      if (part.startsWith("**") && part.endsWith("**")) {
        nodes.push({ type: "bold", text: part.slice(2, -2) })
      } else if (part) {
        nodes.push({ type: "text", text: part })
      }
    }
  }
  return nodes
}

function splitTableRow(line: string): string[] {
  const cells = line.trim().split("|").map((c) => c.trim())
  // Drop the empties from leading/trailing pipes: "| a | b |" → ["a", "b"].
  if (cells.length > 0 && cells[0] === "") cells.shift()
  if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop()
  return cells
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c))
}

function alignForCell(cell: string): TableAlign {
  if (/^:.*:$/.test(cell)) return "center"
  if (/.*:$/.test(cell)) return "right"
  return "left"
}

export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.split("\n")
  const blocks: Block[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === "") {
      i++
      continue
    }

    if (line.trim() === "---") {
      blocks.push({ type: "hr" })
      i++
      continue
    }

    // Pipe tables: header row + separator row, then body rows. A lone
    // pipe-led line without a separator is an ordinary paragraph line.
    if (line.trimStart().startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line).map(parseInline)
      const aligns = splitTableRow(lines[i + 1]).map(alignForCell)
      i += 2
      const rows: InlineNode[][][] = []
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        rows.push(splitTableRow(lines[i]).map(parseInline))
        i++
      }
      const width = Math.max(headers.length, 1)
      const norm = (cells: InlineNode[][]): InlineNode[][] => {
        const out = cells.slice(0, width)
        while (out.length < width) out.push([{ type: "text", text: "" }])
        return out
      }
      blocks.push({
        type: "table",
        headers: norm(headers),
        aligns: Array.from({ length: width }, (_, k) => aligns[k] ?? "left"),
        rows: rows.map(norm),
      })
      continue
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        children: parseInline(headingMatch[2]),
      })
      i++
      continue
    }

    if (line.trimStart().startsWith("- ")) {
      const items: InlineNode[][] = []
      while (i < lines.length && lines[i].trimStart().startsWith("- ")) {
        items.push(parseInline(lines[i].trimStart().slice(2)))
        i++
      }
      blocks.push({ type: "list", ordered: false, items })
      continue
    }

    const numberedMatch = line.match(/^\d+\.\s+(.+)$/)
    if (numberedMatch) {
      const items: InlineNode[][] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\d+\.\s+/, "")))
        i++
      }
      blocks.push({ type: "list", ordered: true, items })
      continue
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      const quoteText = quoteLines.join("\n")
      const childBlocks = parseMarkdown(quoteText)
      blocks.push({ type: "quote", children: childBlocks })
      continue
    }

    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#") && !lines[i].trimStart().startsWith("- ") && !/^\d+\.\s+/.test(lines[i]) && !lines[i].startsWith("> ") && !lines[i].trimStart().startsWith("|") && lines[i].trim() !== "---") {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        children: parseInline(paraLines.join(" ")),
      })
    }
  }

  return blocks
}

function renderInline(nodes: InlineNode[]): React.ReactNode {
  return nodes.map((node, i) => {
    if (node.type === "bold") {
      return React.createElement("strong", { key: i }, node.text)
    }
    if (node.type === "var") {
      return React.createElement(
        "span",
        {
          key: i,
          title: `To complete: ${node.name}`,
          className: "mx-0.5 inline-block rounded border border-dashed border-amber-500/60 bg-amber-50 px-1.5 py-px text-[0.85em] font-medium text-amber-800",
        },
        node.name || "to complete"
      )
    }
    return node.text
  })
}

export function renderMarkdown(markdown: string): React.ReactNode[] {
  const blocks = parseMarkdown(markdown)
  return blocks.map((block, i) => {
    switch (block.type) {
      case "heading": {
        const Tag = `h${block.level}` as keyof React.JSX.IntrinsicElements
        const className = block.level === 1
          ? "text-xl font-bold mt-6 mb-3"
          : block.level === 2
          ? "text-lg font-semibold mt-5 mb-2"
          : "text-base font-semibold mt-4 mb-2"
        return React.createElement(Tag, { key: i, className }, renderInline(block.children))
      }
      case "paragraph":
        return React.createElement("p", { key: i, className: "mb-3 leading-relaxed" }, renderInline(block.children))
      case "list": {
        const Tag = block.ordered ? "ol" : "ul"
        const className = block.ordered ? "mb-3 space-y-1 pl-5 list-decimal" : "mb-3 space-y-1 pl-5 list-disc"
        const items = block.items.map((item, j) =>
          React.createElement("li", { key: j }, renderInline(item))
        )
        return React.createElement(Tag, { key: i, className }, ...items)
      }
      case "hr":
        return React.createElement("hr", { key: i, className: "my-6 border-border" })
      case "table": {
        const alignClass = (a: TableAlign) => (a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left")
        return React.createElement(
          "div",
          { key: i, className: "mb-4 overflow-x-auto" },
          React.createElement(
            "table",
            { className: "w-full border-collapse text-[0.95em]" },
            React.createElement(
              "thead",
              null,
              React.createElement(
                "tr",
                null,
                ...block.headers.map((h, hi) =>
                  React.createElement("th", { key: hi, scope: "col", className: `border-b-2 border-foreground/70 px-3 py-2 font-bold ${alignClass(block.aligns[hi] ?? "left")}` }, renderInline(h))
                )
              )
            ),
            React.createElement(
              "tbody",
              null,
              ...block.rows.map((row, ri) =>
                React.createElement(
                  "tr",
                  { key: ri, className: "border-b border-border/60 last:border-0" },
                  ...row.map((cell, ci) =>
                    React.createElement("td", { key: ci, className: `px-3 py-2 align-top ${alignClass(block.aligns[ci] ?? "left")}` }, renderInline(cell))
                  )
                )
              )
            )
          )
        )
      }
      case "quote": {
        const children = block.children.map((child, ci) => {
          if (child.type === "paragraph") {
            return React.createElement("p", { key: ci, className: "mb-1" }, renderInline(child.children))
          }
          return null
        })
        return React.createElement("blockquote", {
          key: i,
          className: "border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-3",
        }, ...children)
      }
      default:
        return null
    }
  })
}
