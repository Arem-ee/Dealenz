// Client-side sensitive-data masking for pasted deal text. Pure functions,
// no network, no storage: detection and replacement both happen in the
// browser before anything is sent. Conservative by design — high-precision
// classes only (emails, phone numbers, caller-supplied terms). Everything it
// finds is shown for review; nothing is ever masked silently. Amounts, names,
// and addresses are deliberately NOT detected: they shape risk analysis, and
// guessing at them would trade false confidence for false comfort.
export type SensitiveKind = "email" | "phone" | "custom"

export interface SensitiveSpan {
  start: number
  end: number
  kind: SensitiveKind
  value: string
}

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g

// Phone shapes only with an explicit dialling signal (+ prefix, parentheses,
// or dash/dot/space separators in 3-3-4 / 3-4 groupings). Bare digit runs
// (years, amounts, clause numbers) never match.
const PHONE_RES = [
  /\+\d[\d\s().-]{6,}\d/g,
  /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}\b/g,
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g,
  /\b\d{3}[-.\s]\d{4}\b/g,
]

const MAX_SPANS = 200

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function findSensitiveSpans(text: string, customTerms: string[] = []): SensitiveSpan[] {
  if (typeof text !== "string" || text.length === 0) return []
  const spans: SensitiveSpan[] = []
  const push = (start: number, end: number, kind: SensitiveKind, value: string) => {
    if (spans.length >= MAX_SPANS) return
    // Skip anything overlapping an already-accepted span (first match wins).
    for (const s of spans) {
      if (start < s.end && end > s.start) return
    }
    spans.push({ start, end, kind, value })
  }
  for (const m of text.matchAll(EMAIL_RE)) {
    if (typeof m.index === "number") push(m.index, m.index + m[0].length, "email", m[0])
  }
  for (const re of PHONE_RES) {
    re.lastIndex = 0
    for (const m of text.matchAll(re)) {
      if (typeof m.index === "number") push(m.index, m.index + m[0].length, "phone", m[0])
    }
  }
  for (const raw of customTerms) {
    const term = (raw ?? "").trim()
    if (term.length < 2) continue
    const re = new RegExp(escapeRegExp(term), "gi")
    for (const m of text.matchAll(re)) {
      if (typeof m.index === "number") push(m.index, m.index + m[0].length, "custom", m[0])
    }
  }
  spans.sort((a, b) => a.start - b.start)
  return spans
}

export function redactLabel(kind: SensitiveKind, n: number): string {
  return `[${kind} ${n}]`
}

// Applies the given spans (ascending order assigned per kind) and returns
// the masked text plus how many replacements were made.
export function applyRedactions(text: string, spans: SensitiveSpan[]): { text: string; count: number } {
  if (spans.length === 0) return { text, count: 0 }
  const ordered = [...spans].sort((a, b) => a.start - b.start)
  const counters: Record<SensitiveKind, number> = { email: 0, phone: 0, custom: 0 }
  const labeled = ordered.map((s) => {
    counters[s.kind] += 1
    return { ...s, label: redactLabel(s.kind, counters[s.kind]) }
  })
  let out = text
  for (const s of labeled.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, s.start) + s.label + out.slice(s.end)
  }
  return { text: out, count: labeled.length }
}
