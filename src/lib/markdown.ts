import React from "react"

type InlineNode = { type: "text"; text: string } | { type: "bold"; text: string }

interface BlockQuote {
  type: "quote"
  children: Block[]
}

interface BlockHeading {
  type: "heading"
  level: number
  children: InlineNode[]
}

interface BlockParagraph {
  type: "paragraph"
  children: InlineNode[]
}

interface BlockList {
  type: "list"
  ordered: boolean
  items: InlineNode[][]
}

interface BlockHr {
  type: "hr"
}

type Block = BlockQuote | BlockHeading | BlockParagraph | BlockList | BlockHr

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = []
  const parts = text.split(/(\*\*.*?\*\*)/)
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push({ type: "bold", text: part.slice(2, -2) })
    } else if (part) {
      nodes.push({ type: "text", text: part })
    }
  }
  return nodes
}

function parseMarkdown(markdown: string): Block[] {
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
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#") && !lines[i].trimStart().startsWith("- ") && !/^\d+\.\s+/.test(lines[i]) && !lines[i].startsWith("> ") && lines[i].trim() !== "---") {
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
        const className = "mb-3 space-y-1 pl-5"
        const items = block.items.map((item, j) =>
          React.createElement("li", { key: j, className: "list-disc" }, renderInline(item))
        )
        return React.createElement(Tag, { key: i, className }, ...items)
      }
      case "hr":
        return React.createElement("hr", { key: i, className: "my-6 border-border" })
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
