// Shared observation helpers for vertical fact projections (Phase 6).
//
// Extracted from the freelance vertical once a second vertical needed the
// same machinery. These are conservative presence detectors over already
// extracted text, not a parser and not linguistic analysis: every match
// carries its evidence snippet, negated mentions are skipped, and anything
// unobserved stays null (unknown, never false).

import type { ExtractedData } from "@/lib/ai/extract"

export interface ObservedText {
  // Null means not observed in the available input (unknown, not absent).
  text: string | null
  evidence: string | null
}

export interface ObservedFlag {
  // Null means the input says nothing either way (unknown).
  value: boolean | null
  evidence: string | null
}

export function corpusOf(extracted: ExtractedData, rawText?: string): string {
  return [
    rawText ?? "",
    extracted.budget ?? "",
    extracted.timeline ?? "",
    extracted.projectType ?? "",
    ...extracted.goals,
    ...extracted.deliverables,
    ...extracted.clientSignals,
  ].join("\n---\n")
}

export function snippet(corpus: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - 60)
  const end = Math.min(corpus.length, matchIndex + matchLength + 60)
  return corpus.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 200)
}

const NEGATION_BEFORE = /\b(no|not|cannot|n't|without|never|none|neither|missing|lacks?|absent|unaddressed|fails? to)\b/i
const NEGATION_AFTER = /^\s*[:\-–]?\s*(none|n\/a|nil|tbd|tbc|missing)\b/i

// A negated mention ("no termination clause", "termination: none") is not an
// affirmative observation. Matches inside a negation window are skipped so
// absence-family rules keep working; the window sizes are documented
// heuristics, not linguistic analysis. Windows never cross the "---" section
// boundaries between corpus parts, so a negation in one input section cannot
// suppress an affirmative mention in another. Known limitation: prohibitions
// worded as negations ("No subletting without consent") also read as
// unobserved; the safe direction is less coverage, never false certainty.
export function isNegated(corpus: string, matchIndex: number, matchLength: number): boolean {
  const rawBefore = corpus.slice(Math.max(0, matchIndex - 30), matchIndex)
  const before = rawBefore.includes("---") ? rawBefore.slice(rawBefore.lastIndexOf("---") + 3) : rawBefore
  if (NEGATION_BEFORE.test(before)) return true
  // Skip the rest of the matched word first, so "Liability: none" checks the
  // value position rather than the word interior.
  const restOfWord = /^[A-Za-z]*/.exec(corpus.slice(matchIndex + matchLength))?.[0] ?? ""
  const rawAfter = corpus.slice(
    matchIndex + matchLength + restOfWord.length,
    matchIndex + matchLength + restOfWord.length + 20
  )
  const after = rawAfter.includes("---") ? rawAfter.slice(0, rawAfter.indexOf("---")) : rawAfter
  if (NEGATION_AFTER.test(after)) return true
  return false
}

export function findFirst(corpus: string, pattern: RegExp): { text: string; evidence: string } | null {
  const flags = pattern.flags.includes("i") ? pattern.flags : `${pattern.flags}i`
  const re = new RegExp(pattern.source, flags.includes("g") ? flags : `${flags}g`)
  let match: RegExpExecArray | null
  while ((match = re.exec(corpus)) !== null) {
    if (!match[0]) {
      re.lastIndex += 1
      continue
    }
    if (isNegated(corpus, match.index, match[0].length)) continue
    return { text: match[0].trim(), evidence: snippet(corpus, match.index, match[0].length) }
  }
  return null
}

export function flag(corpus: string, pattern: RegExp): ObservedFlag {
  const found = findFirst(corpus, pattern)
  if (!found) return { value: null, evidence: null }
  return { value: true, evidence: found.evidence }
}

export function text(corpus: string, pattern: RegExp): ObservedText {
  const found = findFirst(corpus, pattern)
  if (!found) return { text: null, evidence: null }
  return found
}
