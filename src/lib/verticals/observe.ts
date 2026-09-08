// Shared observation helpers for vertical fact projections (Phase 6).
//
// Extracted from the freelance vertical once a second vertical needed the
// same machinery. These are conservative presence detectors over already
// extracted text, not a parser and not linguistic analysis: every match
// carries its evidence snippet, negated mentions are skipped, and anything
// unobserved stays null (unknown, never false).

import type { ExtractedData } from "@/lib/ai/extract"
import { makeEvidence, type Evidence, type EvidenceSourceType } from "@/lib/evidence/schema"

export interface ObservedText {
  // Null means not observed in the available input (unknown, not absent).
  text: string | null
  evidence: string | null
  // Validated Evidence references supporting this observation. Absent means
  // none was attached (e.g. hand-constructed test fixtures); never fabricate.
  evidenceRefs?: Evidence[]
}

export interface ObservedFlag {
  // Null means the input says nothing either way (unknown).
  value: boolean | null
  evidence: string | null
  // Validated Evidence references supporting this observation.
  evidenceRefs?: Evidence[]
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

export interface CorpusSection {
  section: string
  text: string
}

// The corpus as labeled sections, laid out EXACTLY as corpusOf joins them
// (one part per input, same separator), so matching behavior is unchanged.
// Sections let later stages say *which portion* of the source supported an
// observation without changing what the joined-corpus matcher sees.
export function sectionedParts(extracted: ExtractedData, rawText?: string): CorpusSection[] {
  return [
    { section: "raw_input", text: rawText ?? "" },
    { section: "budget", text: extracted.budget ?? "" },
    { section: "timeline", text: extracted.timeline ?? "" },
    { section: "project_type", text: extracted.projectType ?? "" },
    ...extracted.goals.map((text) => ({ section: "goals", text })),
    ...extracted.deliverables.map((text) => ({ section: "deliverables", text })),
    ...extracted.clientSignals.map((text) => ({ section: "client_signals", text })),
  ]
}

const SECTION_SEPARATOR = "\n---\n"

// Maps a joined-corpus match index back to its section label. Returns null
// when the index falls on a separator (never an observation).
export function locateSection(parts: CorpusSection[], index: number): string | null {
  return locateSectionRange(parts, index)?.section ?? null
}

// Same as locateSection but also returns the section's start offset within
// the joined corpus, so a match position can be translated into
// section-local offsets. Returns null on separators.
export function locateSectionRange(
  parts: CorpusSection[],
  index: number
): { section: string; start: number; end: number } | null {
  let offset = 0
  for (const part of parts) {
    const start = offset
    const end = offset + part.text.length
    if (index >= start && index < end) return { section: part.section, start, end }
    offset = end + SECTION_SEPARATOR.length
  }
  return null
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
  const found = findFirstIndexed(corpus, pattern)
  if (!found) return null
  return { text: found.text, evidence: found.evidence }
}

function findFirstIndexed(
  corpus: string,
  pattern: RegExp
): { text: string; evidence: string; index: number; length: number } | null {
  const flags = pattern.flags.includes("i") ? pattern.flags : `${pattern.flags}i`
  const re = new RegExp(pattern.source, flags.includes("g") ? flags : `${flags}g`)
  let match: RegExpExecArray | null
  while ((match = re.exec(corpus)) !== null) {
    if (!match[0]) {
      re.lastIndex += 1
      continue
    }
    if (isNegated(corpus, match.index, match[0].length)) continue
    return { text: match[0].trim(), evidence: snippet(corpus, match.index, match[0].length), index: match.index, length: match[0].length }
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

// Where observed raw text came from. Audit inputs are persisted and
// inspectable; conversation inputs without an audit are ephemeral.
export interface ObservationSource {
  type: "audit_input" | "conversation_input"
  id: string | null
}

// Fixed method confidence for verbatim pattern matches over input text.
// Documented heuristic: the text was literally observed, so confidence is
// high, but it is still an observation, never certainty and never law.
export const PATTERN_OBSERVATION_CONFIDENCE = 0.8

export interface PatternObservationOptions {
  // Fact path this observation supports, e.g. "facts.freelance.fee".
  key: string
  source: ObservationSource
}

function sourceTypeOf(source: ObservationSource): EvidenceSourceType {
  return source.type
}

// Pattern observation that also attaches a validated Evidence reference.
// Matching semantics are identical to text()/flag() (same joined corpus,
// same negation handling); the addition is section + evidence metadata, with
// exact offsets when the raw_input provenance chain is fully proven (see
// above). The evidence quote is the observed text itself; the wider snippet
// stays on the returned `evidence` display string only.
//
// Exact spans are emitted ONLY when every link in the chain is proven:
// the match lies entirely inside the raw_input section (whose text is the
// verbatim user input the viewer will display), and the source is
// inspectable (a persisted audit, so the offsets can be verified at display
// time). Everything else stays approximate or unavailable — offsets are
// never manufactured for extraction-derived text, file content the pipeline
// never searched, or ephemeral conversation input.
export function observePattern(
  parts: CorpusSection[],
  pattern: RegExp,
  options: PatternObservationOptions
): ObservedText & { evidenceRefs: Evidence[] } {
  const corpus = parts.map((part) => part.text).join("\n---\n")
  const found = findFirstIndexed(corpus, pattern)
  if (!found) return { text: null, evidence: null, evidenceRefs: [] }
  const range = locateSectionRange(parts, found.index)
  const section = range?.section
  const inspectableSource = options.source.type === "audit_input" && options.source.id !== null
  const exact =
    section === "raw_input" &&
    range !== null &&
    found.index + found.text.length <= range.end &&
    inspectableSource
  const location = exact
    ? {
        kind: "exact" as const,
        section: "raw_input",
        startOffset: found.index - (range as { start: number }).start,
        endOffset: found.index - (range as { start: number }).start + found.text.length,
      }
    : section
      ? { kind: "approximate" as const, section }
      : { kind: "unavailable" as const }
  const evidence = makeEvidence({
    sourceType: sourceTypeOf(options.source),
    sourceId: options.source.id,
    // The quote is the observed text itself (not the wider snippet window),
    // so stored exact offsets always verify against it at display time.
    quote: found.text,
    observationKey: options.key,
    method: "pattern_observation",
    confidence: PATTERN_OBSERVATION_CONFIDENCE,
    inspectable: inspectableSource,
    location,
  })
  return { text: found.text, evidence: found.evidence, evidenceRefs: [evidence] }
}

export function observeFlag(
  parts: CorpusSection[],
  pattern: RegExp,
  options: PatternObservationOptions
): ObservedFlag & { evidenceRefs: Evidence[] } {
  const observed = observePattern(parts, pattern, options)
  if (observed.text === null) return { value: null, evidence: null, evidenceRefs: [] }
  return { value: true, evidence: observed.evidence, evidenceRefs: observed.evidenceRefs }
}
