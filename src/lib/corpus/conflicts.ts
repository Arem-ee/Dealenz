import { createHash } from "node:crypto"

// Corpus clause segmentation + deterministic cross-contract conflict
// detectors. Pure: same text in, same clauses and conflicts out. Detectors
// are conservative keyword-overlap rules over the new material and the
// indexed corpus — they flag candidates for human review, never verdicts.

export interface CorpusSection {
  key: string
  title: string
  quote: string
  textHash: string
}

export function hashText(text: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim()
  return createHash("sha256").update(normalized, "utf8").digest("hex")
}

function slugify(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return slug || `section-${index}`
}

/**
 * Segments markdown assembly output into clauses at H3 boundaries
 * ("### Title" + body). Documents without sections index whole — never
 * silently skipped, never split mid-sentence by heuristics.
 */
export function segmentClauses(markdown: string): CorpusSection[] {
  const lines = markdown.split("\n")
  const sections: Array<{ title: string; body: string[] }> = []
  let current: { title: string; body: string[] } | null = null
  for (const line of lines) {
    const h3 = line.match(/^###\s+(.+?)\s*$/)
    if (h3) {
      if (current) sections.push(current)
      current = { title: h3[1]!.trim(), body: [] }
    } else if (current) {
      current.body.push(line)
    }
  }
  if (current) sections.push(current)

  const kept = sections
    .map((s, i) => ({ title: s.title, quote: s.body.join("\n").trim().slice(0, 2000), index: i }))
    .filter((s) => s.quote.length >= 20)
  if (kept.length === 0) {
    const whole = markdown.trim().slice(0, 2000)
    if (whole.length < 20) return []
    return [{ key: "document", title: "Full document", quote: whole, textHash: hashText(whole) }]
  }
  return kept.map((s) => ({
    key: slugify(s.title, s.index),
    title: s.title,
    quote: s.quote,
    textHash: hashText(`${s.title}\n${s.quote}`),
  }))
}

export interface CorpusClause {
  auditId: string
  auditTitle: string
  clauseKey: string
  title: string
  quote: string
}

export type CorpusConflictType = "exclusivity" | "assignment" | "liability_stack"

export interface CorpusConflict {
  type: CorpusConflictType
  message: string
  auditId: string
  auditTitle: string
  clauseTitle: string
  quote: string
}

const PATTERNS: Record<CorpusConflictType, { label: string; re: RegExp; message: (title: string) => string }> = {
  exclusivity: {
    label: "Exclusive scope",
    re: /\bexclusive\b|\bexclusivity\b|\bsole (provider|supplier|vendor|distributor)\b|\bnon-?compete\b/i,
    message: (title) => `Grants exclusive scope here — but “${title}” already promises scope elsewhere. Only one of them can hold it.`,
  },
  assignment: {
    label: "Assignment or transfer",
    re: /\bassign(ment|ed|s)?\b|\btransfer\b|\bchange of control\b|\bsublicense\b/i,
    message: (title) => `Touches assignment or transfer — “${title}” already constrains it. Read the two together before agreeing.`,
  },
  liability_stack: {
    label: "Liability exposure",
    re: /\buncapped\b|\bwithout (limitation|cap)\b|\bunlimited liability\b/i,
    message: (title) => `Leaves liability uncapped here while “${title}” carries its own exposure. Stacked uncapped positions multiply.`,
  },
}

/**
 * Checks new material against other deals' indexed clauses. A detector
 * fires only when BOTH sides carry the pattern — one-sided language is
 * the deterministic engine's job, not the corpus's. Same-deal clauses
 * never self-conflict.
 */
export function findCorpusConflicts(material: string, corpus: CorpusClause[], ownAuditId: string): CorpusConflict[] {
  const conflicts: CorpusConflict[] = []
  const seen = new Set<string>()
  const types = Object.keys(PATTERNS) as CorpusConflictType[]
  for (const type of types) {
    const { re, message } = PATTERNS[type]
    if (!re.test(material)) continue
    for (const c of corpus) {
      if (c.auditId === ownAuditId) continue
      if (!re.test(`${c.title}\n${c.quote}`)) continue
      const key = `${type}:${c.auditId}:${c.clauseKey}`
      if (seen.has(key)) continue
      seen.add(key)
      conflicts.push({
        type,
        message: message(c.auditTitle),
        auditId: c.auditId,
        auditTitle: c.auditTitle,
        clauseTitle: c.title,
        quote: c.quote.slice(0, 300),
      })
    }
  }
  return conflicts.slice(0, 10)
}
