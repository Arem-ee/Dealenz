// Freelance vertical: structured facts (Phase 5E).
//
// A deterministic projection of the existing ExtractedData plus the raw input
// text into freelance-meaningful facts. This is NOT a second extractor: it
// invents nothing, runs no AI, and every observed value carries the evidence
// snippet it came from. Anything not observed stays null (unknown), and rules
// not the projection decide what unknown means. Structured facts remain
// distinct from inferred conclusions at every step.

import type { ExtractedData } from "@/lib/ai/extract"
import { makeEvidence } from "@/lib/evidence/schema"
import {
  observeFlag,
  observePattern,
  sectionedParts,
  type ObservedFlag,
  type ObservedText,
  type ObservationSource,
} from "@/lib/verticals/observe"

export type { ObservedFlag, ObservedText }

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

// Deterministic freelance fact projection. Pure: same extraction plus same
// raw text plus same source always yields the same facts. Patterns are
// deliberately conservative presence detectors over the extraction output,
// not a parser. Every affirmative observation carries validated Evidence
// references; unobserved facts carry none.
export function deriveFreelanceFacts(
  extracted: ExtractedData,
  rawText?: string,
  source?: ObservationSource
): FreelanceFacts {
  const src: ObservationSource = source ?? { type: "conversation_input", id: null }
  const parts = sectionedParts(extracted, rawText)
  const key = (field: string) => `facts.freelance.${field}`
  const inspectable = src.type === "audit_input" && src.id !== null

  const extractionEvidence = (observationKey: string, value: string) => [
    makeEvidence({
      sourceType: "extraction",
      sourceId: src.id,
      quote: value.slice(0, 200),
      observationKey,
      method: "ai_extraction",
      confidence: extracted.confidence,
      inspectable,
      location: { kind: "unavailable" },
    }),
  ]

  const currency = observePattern(parts, /\b(USD|EUR|NGN|GBP|GHS|KES|ZAR|CAD|AUD)\b/, {
    key: key("currency"),
    source: src,
  })

  return {
    fee: extracted.budget
      ? {
          text: extracted.budget,
          evidence: extracted.budget.slice(0, 200),
          evidenceRefs: extractionEvidence(key("fee"), extracted.budget),
        }
      : { text: null, evidence: null, evidenceRefs: [] },
    currency: currency.text
      ? { text: currency.text.toUpperCase(), evidence: currency.evidence, evidenceRefs: currency.evidenceRefs }
      : { text: null, evidence: null, evidenceRefs: [] },
    paymentTiming: observePattern(parts, /net\s*\d+|payment schedule|upon completion|on delivery|milestone\s*payment|weekly|monthly|30-day payment|15-day payment/i, { key: key("paymentTiming"), source: src }),
    deposit: observePattern(parts, /\d+\s*%\s*(upfront|deposit|advance)|deposit of [^\n]{1,60}|upfront payment[^\n]{0,60}/i, { key: key("deposit"), source: src }),
    milestones: observePattern(parts, /milestone|phase \d|stage \d|deliverable\s*\d/i, { key: key("milestones"), source: src }),
    revisions: observePattern(parts, /revision|revision round|change request|amendment round/i, { key: key("revisions"), source: src }),
    unlimitedRevisions: observeFlag(parts, /unlimited revision|unlimited change|unlimited amendment|infinite revision/i, { key: key("unlimitedRevisions"), source: src }),
    delivery: extracted.timeline
      ? {
          text: extracted.timeline,
          evidence: extracted.timeline.slice(0, 200),
          evidenceRefs: extractionEvidence(key("delivery"), extracted.timeline),
        }
      : { text: null, evidence: null, evidenceRefs: [] },
    acceptance: observePattern(parts, /acceptance|sign.?off|approval|accept the (work|deliverable)/i, { key: key("acceptance"), source: src }),
    termination: observePattern(parts, /terminat|cancel(l)?ation|end the agreement|walk away/i, { key: key("termination"), source: src }),
    ownership: observePattern(parts, /ownership|intellectual property|\bIP\b|assign(s|ment)?|work for hire|work made for hire/i, { key: key("ownership"), source: src }),
    confidentiality: observePattern(parts, /confidential|nda|non.?disclosure/i, { key: key("confidentiality"), source: src }),
    liability: observePattern(parts, /liab|indemnif|hold harmless|damages/i, { key: key("liability"), source: src }),
    // "unlimited" contains "limit" but means the opposite of a cap: the
    // lookbehind keeps the liability-capacity alternative honest.
    liabilityCap: observePattern(parts, /cap(ped)?|limited to|maximum liability|not exceed|liability.{0,40}(?<!un)limit/i, { key: key("liabilityCap"), source: src }),
    indemnity: observePattern(parts, /indemnif|hold harmless/i, { key: key("indemnity"), source: src }),
    disputeResolution: observePattern(parts, /arbitrat|mediation|dispute resolution|governing law|jurisdiction|small claims|court of [^\n]{1,40}/i, { key: key("disputeResolution"), source: src }),
    deliverablesCount: extracted.deliverables.length,
  }
}
