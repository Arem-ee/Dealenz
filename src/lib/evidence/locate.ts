// Span location with verification — for third-party text ONLY (D2).
//
// Own versions carry recorded anchors (see assembly ClauseAnchor); this
// module locates quoted spans inside text we did NOT generate
// (counterparty redlines, pasted material). Verdicts mirror the evidence
// doctrine: verbatim locate → EXACT; Jaccard ≥ 0.5 sentence locate →
// APPROXIMATE with score; else UNAVAILABLE with human review.
// Ungrounded spans are dropped by the caller, never trusted.

export type LocatedSpan =
  | { kind: "EXACT"; startOffset: number; endOffset: number }
  | { kind: "APPROXIMATE"; startOffset: number; endOffset: number; score: number }
  | { kind: "UNAVAILABLE" }

export const APPROXIMATE_THRESHOLD = 0.5

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim()
}

function words(text: string): string[] {
  return normalize(text)
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(" ")
    .filter((w) => w.length > 0)
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let intersection = 0
  for (const w of setA) if (setB.has(w)) intersection++
  return intersection / (setA.size + setB.size - intersection)
}

/** Splits into sentences, keeping character offsets into the original. */
export function splitSentences(text: string): Array<{ text: string; startOffset: number; endOffset: number }> {
  const out: Array<{ text: string; startOffset: number; endOffset: number }> = []
  const re = /[^.!?]+[.!?]+["”)]?\s*/g
  let m: RegExpExecArray | null
  let lastEnd = 0
  while ((m = re.exec(text)) !== null) {
    const raw = m[0]
    const start = m.index + (raw.length - raw.trimStart().length)
    const end = m.index + raw.length
    if (raw.trim().length > 0) out.push({ text: raw, startOffset: start, endOffset: end })
    lastEnd = end
  }
  const tail = text.slice(lastEnd)
  if (tail.trim().length > 0) {
    const start = lastEnd + (tail.length - tail.trimStart().length)
    out.push({ text: tail, startOffset: start, endOffset: text.length })
  }
  return out
}

/**
 * Locates a quoted span in third-party text. Verbatim (whitespace-
 * collapsed) match wins EXACT; otherwise the best sentence-window Jaccard
 * at or above threshold wins APPROXIMATE; otherwise UNAVAILABLE.
 */
export function locateSpan(documentText: string, quote: string): LocatedSpan {
  if (!documentText || !quote || quote.trim().length === 0) return { kind: "UNAVAILABLE" }
  const docNorm = normalize(documentText)
  const quoteNorm = normalize(quote)
  if (quoteNorm.length === 0) return { kind: "UNAVAILABLE" }

  // EXACT: verbatim under whitespace collapsing. Rebuild the collapsed
  // document alongside a collapsed-offset → raw-offset map, then slice.
  // Matches normalize() exactly (lowercase, runs → single space, trim).
  const collapsedIndex = docNorm.indexOf(quoteNorm)
  if (collapsedIndex >= 0) {
    const lower = documentText.toLowerCase()
    let rebuilt = ""
    const map: number[] = []
    let pendingSpace = false
    for (let i = 0; i < lower.length; i++) {
      if (/\s/.test(lower[i]!)) {
        pendingSpace = true
        continue
      }
      if (pendingSpace && rebuilt.length > 0) {
        rebuilt += " "
        map.push(i) // collapsed space attributed to the raw run start
      }
      rebuilt += lower[i]
      map.push(i)
      pendingSpace = false
    }
    if (rebuilt === docNorm) {
      const start = map[collapsedIndex]!
      const end = map[collapsedIndex + quoteNorm.length - 1]! + 1
      if (start >= 0 && end > start) {
        return { kind: "EXACT", startOffset: start, endOffset: end }
      }
    }
  }

  // APPROXIMATE: best sentence-window Jaccard at threshold.
  const sentences = splitSentences(documentText)
  const quoteWords = words(quote)
  if (quoteWords.length === 0) return { kind: "UNAVAILABLE" }
  let best: { startOffset: number; endOffset: number; score: number } | null = null
  for (let w = 0; w < sentences.length; w++) {
    for (let span = 1; span <= 3 && w + span <= sentences.length; span++) {
      const window = sentences.slice(w, w + span)
      const text = window.map((s) => s.text).join(" ")
      const score = jaccard(quoteWords, words(text))
      if ((!best || score > best.score) && score >= APPROXIMATE_THRESHOLD) {
        best = {
          startOffset: window[0]!.startOffset,
          endOffset: window[window.length - 1]!.endOffset,
          score: Math.round(score * 100) / 100,
        }
      }
    }
  }
  if (best) return { kind: "APPROXIMATE", ...best }
  return { kind: "UNAVAILABLE" }
}
