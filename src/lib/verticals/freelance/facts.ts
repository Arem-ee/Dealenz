// Freelance vertical: structured facts (Phase 5E).
//
// A deterministic projection of the existing ExtractedData plus the raw input
// text into freelance-meaningful facts. This is NOT a second extractor: it
// invents nothing, runs no AI, and every observed value carries the evidence
// snippet it came from. Anything not observed stays null (unknown), and rules
// not the projection decide what unknown means. Structured facts remain
// distinct from inferred conclusions at every step.

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

export interface FreelanceFacts {
  fee: ObservedText
  currency: ObservedText
  paymentTiming: ObservedText
  deposit: ObservedText
  milestones: ObservedText
  revisions: ObservedText
  unlimitedRevisions: ObservedFlag
  delivery: ObservedText
  acceptance: ObservedText
  termination: ObservedText
  ownership: ObservedText
  confidentiality: ObservedText
  liability: ObservedText
  liabilityCap: ObservedText
  indemnity: ObservedText
  disputeResolution: ObservedText
  deliverablesCount: number
}

function corpusOf(extracted: ExtractedData, rawText?: string): string {
  return [
    rawText ?? "",
    extracted.budget ?? "",
    extracted.timeline ?? "",
    extracted.projectType ?? "",
    ...extracted.goals,
    ...extracted.deliverables,
    ...extracted.clientSignals,
  ].join("\n")
}

function snippet(corpus: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - 60)
  const end = Math.min(corpus.length, matchIndex + matchLength + 60)
  return corpus.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 200)
}

const NEGATION_BEFORE = /\b(no|not|cannot|n't|without|never|none|neither|missing|lacks?|absent|unaddressed|fails? to)\b/i
const NEGATION_AFTER = /^\s*[:\-–]?\s*(none|n\/a|nil|tbd|tbc|missing)\b/i

// A negated mention ("no termination clause", "termination: none") is not an
// affirmative observation. Matches inside a negation window are skipped so
// absence-family rules keep working; the window sizes are documented
// heuristics, not linguistic analysis.
function isNegated(corpus: string, matchIndex: number, matchLength: number): boolean {
  const before = corpus.slice(Math.max(0, matchIndex - 30), matchIndex)
  if (NEGATION_BEFORE.test(before)) return true
  const after = corpus.slice(matchIndex + matchLength, matchIndex + matchLength + 20)
  if (NEGATION_AFTER.test(after)) return true
  return false
}

function findFirst(corpus: string, pattern: RegExp): { text: string; evidence: string } | null {
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

function flag(corpus: string, pattern: RegExp): ObservedFlag {
  const found = findFirst(corpus, pattern)
  if (!found) return { value: null, evidence: null }
  return { value: true, evidence: found.evidence }
}

function text(corpus: string, pattern: RegExp): ObservedText {
  const found = findFirst(corpus, pattern)
  if (!found) return { text: null, evidence: null }
  return found
}

// Deterministic freelance fact projection. Pure: same extraction plus same
// raw text always yields the same facts. Patterns are deliberately
// conservative presence detectors over the extraction output, not a parser.
export function deriveFreelanceFacts(extracted: ExtractedData, rawText?: string): FreelanceFacts {
  const corpus = corpusOf(extracted, rawText)

  const currency = findFirst(corpus, /\b(USD|EUR|NGN|GBP|GHS|KES|ZAR|CAD|AUD)\b/)

  return {
    fee: extracted.budget
      ? { text: extracted.budget, evidence: extracted.budget.slice(0, 200) }
      : { text: null, evidence: null },
    currency: currency ? { text: currency.text.toUpperCase(), evidence: currency.evidence } : { text: null, evidence: null },
    paymentTiming: text(corpus, /net\s*\d+|payment schedule|upon completion|on delivery|milestone\s*payment|weekly|monthly|30-day payment|15-day payment/i),
    deposit: text(corpus, /\d+\s*%\s*(upfront|deposit|advance)|deposit of [^\n]{1,60}|upfront payment[^\n]{0,60}/i),
    milestones: text(corpus, /milestone|phase \d|stage \d|deliverable\s*\d/i),
    revisions: text(corpus, /revision|revision round|change request|amendment round/i),
    unlimitedRevisions: flag(corpus, /unlimited revision|unlimited change|unlimited amendment|infinite revision/i),
    delivery: extracted.timeline
      ? { text: extracted.timeline, evidence: extracted.timeline.slice(0, 200) }
      : { text: null, evidence: null },
    acceptance: text(corpus, /acceptance|sign.?off|approval|accept the (work|deliverable)/i),
    termination: text(corpus, /terminat|cancel(l)?ation|end the agreement|walk away/i),
    ownership: text(corpus, /ownership|intellectual property|\bIP\b|assign(s|ment)?|work for hire|work made for hire/i),
    confidentiality: text(corpus, /confidential|nda|non.?disclosure/i),
    liability: text(corpus, /liab|indemnif|hold harmless|damages/i),
    // "unlimited" contains "limit" but means the opposite of a cap: the
    // lookbehind keeps the liability-capacity alternative honest.
    liabilityCap: text(corpus, /cap(ped)?|limited to|maximum liability|not exceed|liability.{0,40}(?<!un)limit/i),
    indemnity: text(corpus, /indemnif|hold harmless/i),
    disputeResolution: text(corpus, /arbitrat|mediation|dispute resolution|governing law|jurisdiction|small claims|court of [^\n]{1,40}/i),
    deliverablesCount: extracted.deliverables.length,
  }
}
