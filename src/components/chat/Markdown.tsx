import { Fragment, type ReactNode } from "react"

// Minimal safe markdown subset for chat bubbles: bold, italic, inline code,
// paragraphs, headings, and lists. Deliberately dependency-free and
// dangerouslySetInnerHTML-free: every string lands in React as a text node,
// so embedded HTML is displayed literally, never executed. URLs stay plain
// text (no links), which removes javascript: and phishing-link risk.
// Unmatched markers (a lone * in "5 * 3") render literally.

const INLINE_RE = /\*\*.+?\*\*|\*\S(?:[^*\n]*?\S)?\*|`[^`\n]+?`/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // Italic requires non-space flanking (CommonMark-inspired): a spaced star
  // in "5 * 3" is arithmetic, not emphasis, and must render literally.
  // Matches are positional via matchAll: a literal span is never re-tested
  // as a token, so stray markers cannot misrender.
  const out: ReactNode[] = []
  let last = 0
  let n = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0
    if (idx > last) {
      out.push(<Fragment key={`${keyPrefix}-t${n++}`}>{text.slice(last, idx)}</Fragment>)
    }
    const token = m[0]
    const key = `${keyPrefix}-t${n++}`
    if (token.startsWith("**")) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith("*")) {
      out.push(<em key={key}>{token.slice(1, -1)}</em>)
    } else {
      out.push(
        <code key={key} className="rounded bg-foreground/10 px-1 py-px text-[0.9em]">
          {token.slice(1, -1)}
        </code>
      )
    }
    last = idx + token.length
  }
  if (last < text.length) {
    out.push(<Fragment key={`${keyPrefix}-t${n++}`}>{text.slice(last)}</Fragment>)
  }
  return out
}

function isListItem(line: string): boolean {
  return /^\s*([-*]|\d+[.)])\s+/.test(line)
}

function renderListItem(line: string, key: string): ReactNode {
  const content = line.replace(/^\s*([-*]|\d+[.)])\s+/, "")
  return <li key={key}>{renderInline(content, key)}</li>
}

function renderBlocks(text: string): ReactNode[] {
  const blocks = text.split(/\n{2,}/)
  return blocks.map((block, bi) => {
    const key = `b${bi}`
    const heading = block.match(/^(#{1,3})\s+([\s\S]*)$/)
    if (heading) {
      return (
        <p key={key} className="font-semibold">
          {renderInline(heading[2].trim(), key)}
        </p>
      )
    }
    const lines = block.split("\n")
    if (lines.length > 1 && lines.every((l) => l.trim() === "" || isListItem(l))) {
      const items = lines.filter((l) => l.trim() !== "")
      const ordered = /^\s*\d+[.)]\s+/.test(items[0] ?? "")
      const List = ordered ? "ol" : "ul"
      return (
        <List key={key} className={ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
          {items.map((l, li) => renderListItem(l, `${key}-${li}`))}
        </List>
      )
    }
    if (lines.length === 1 && isListItem(lines[0])) {
      return (
        <ul key={key} className="list-disc space-y-1 pl-5">
          {[renderListItem(lines[0], `${key}-0`)]}
        </ul>
      )
    }
    return (
      <p key={key}>
        {lines.map((line, li) => (
          <Fragment key={`${key}-${li}`}>
            {li > 0 && <br />}
            {renderInline(line, `${key}-${li}`)}
          </Fragment>
        ))}
      </p>
    )
  })
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  return <div className={className ? `space-y-2 ${className}` : "space-y-2"}>{renderBlocks(text)}</div>
}

// Inline-only variant for list items and other inline slots: no block
// elements, so it nests safely inside <li> and <p>.
export function MarkdownInline({ text }: { text: string }) {
  return <span>{renderInline(text.replace(/\n/g, " "), "inline")}</span>
}
