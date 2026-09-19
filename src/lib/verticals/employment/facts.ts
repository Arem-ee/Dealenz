// Employment vertical: structured facts (Phase 14).
//
// Deterministic projection of ExtractedData plus raw input into
// employment-meaningful facts. No second extractor, no AI, every
// observed value carries evidence, unobserved stays null (unknown, not false).
// Observation helpers are shared from @/lib/verticals/observe.

import type { ExtractedData } from "@/lib/ai/extract"
import { makeEvidence } from "@/lib/evidence/schema"
import {
  observePattern,
  sectionedParts,
  type ObservedFlag,
  type ObservedText,
  type ObservationSource,
} from "@/lib/verticals/observe"

export interface EmploymentFacts {
  role: ObservedText
  compensation: ObservedText
  currency: ObservedText
  paymentFrequency: ObservedText
  commencement: ObservedText
  termDuration: ObservedText
  workingArrangement: ObservedText
  duties: ObservedText
  probation: ObservedText
  termination: ObservedText
  notice: ObservedText
  leave: ObservedText
  confidentiality: ObservedText
  intellectualProperty: ObservedText
  restrictive: ObservedText
  liability: ObservedText
  liabilityCap: ObservedText
  benefits: ObservedText
  dispute: ObservedText
  // Structural preservation of conflicting observations (same pattern as
  // freelance/generic): separate budget/timeline terms stay separate.
  conflictingPaymentTerms: ObservedFlag
  conflictingTimelineTerms: ObservedFlag
}

// Pure: same extraction + same raw text + same source → same facts.
export function deriveEmploymentFacts(
  extracted: ExtractedData,
  rawText?: string,
  source?: ObservationSource
): EmploymentFacts {
  const src: ObservationSource = source ?? { type: "conversation_input", id: null }
  const parts = sectionedParts(extracted, rawText)
  const key = (field: string) => `facts.employment.${field}`
  const obs = (field: string, pattern: RegExp) => observePattern(parts, pattern, { key: key(field), source: src })
  const inspectable = src.type === "audit_input" && src.id !== null

  // Structural conflicting-terms detection — preserve separate observations.
  // Defensive: legacy audits/test fixtures may lack the new arrays.
  const budgetTerms = extracted.budgetTerms ?? []
  const timelineTerms = extracted.timelineTerms ?? []
  const conflictingPaymentTerms: ObservedFlag =
    budgetTerms.length > 1
      ? {
          value: true,
          evidence: `Conflicting payment terms: ${budgetTerms.join(" | ").slice(0, 120)}`,
          evidenceRefs: [
            makeEvidence({
              sourceType: "extraction",
              sourceId: src.id,
              quote: budgetTerms.join(" | ").slice(0, 200),
              observationKey: key("conflictingPaymentTerms"),
              method: "ai_extraction",
              confidence: extracted.confidence,
              inspectable,
              location: { kind: "unavailable" },
            }),
          ],
        }
      : { value: null, evidence: null, evidenceRefs: [] }
  const conflictingTimelineTerms: ObservedFlag =
    timelineTerms.length > 1
      ? {
          value: true,
          evidence: `Conflicting timeline terms: ${timelineTerms.join(" | ").slice(0, 120)}`,
          evidenceRefs: [
            makeEvidence({
              sourceType: "extraction",
              sourceId: src.id,
              quote: timelineTerms.join(" | ").slice(0, 200),
              observationKey: key("conflictingTimelineTerms"),
              method: "ai_extraction",
              confidence: extracted.confidence,
              inspectable,
              location: { kind: "unavailable" },
            }),
          ],
        }
      : { value: null, evidence: null, evidenceRefs: [] }

  const compensationFromExtraction = extracted.budget
    ? {
        text: extracted.budget,
        evidence: extracted.budget.slice(0, 200),
        evidenceRefs: [
          makeEvidence({
            sourceType: "extraction",
            sourceId: src.id,
            quote: extracted.budget.slice(0, 200),
            observationKey: key("compensation"),
            method: "ai_extraction",
            confidence: extracted.confidence,
            inspectable,
            location: { kind: "unavailable" },
          }),
        ],
      }
    : null

  // Fallback to explicit compensation phrasing when extraction budget is absent.
  const compensationFallback = obs(
    "compensation",
    /compensation|salary|wage|pay of [^\n]{1,40}|remuneration|base pay/i
  )

  return {
    role: obs("role", /\b(role|position|title)\b[^\n]{0,60}|job title|employment as [^\n]{1,40}/i),
    compensation: compensationFromExtraction ?? compensationFallback,
    currency: obs("currency", /\b(USD|EUR|NGN|GBP|GHS|KES|ZAR|CAD|AUD)\b/),
    paymentFrequency: obs("paymentFrequency", /monthly|per month|per annum|annually|weekly|biweekly|fortnightly|per hour|hourly|salary.*paid/i),
    commencement: obs("commencement", /commencement|start date|commences|employment begins|effective from|first day/i),
    termDuration: obs(
      "termDuration",
      /term of [^\n]{1,60}|fixed term|permanent|indefinite|probation.*month|duration[^\n]{0,60}month|contract (period|length)|(\d+)[\s-]+(year|month)s?[^\n]{0,30}?(employment|contract|term)/i
    ),
    workingArrangement: obs(
      "workingArrangement",
      /working arrangement|remote|hybrid|on[- ]site|work (from|at) (home|office)|working hours|hours of work|work schedule/i
    ),
    duties: obs("duties", /duties|responsibilities|role responsibilities|job description|scope of (work|employment)|performs? the following/i),
    probation: obs("probation", /probation|probationary|trial period/i),
    termination: obs("termination", /terminat|dismissal|resignation|redundancy|end the employment|ground for dismissal/i),
    notice: obs("notice", /(\d+)\s*(day|week|month)s?('?s)? notice|notice period|notice of termination|period of notice/i),
    leave: obs("leave", /annual leave|paid leave|vacation|PTO|time off|sick leave|holiday entitlement/i),
    confidentiality: obs("confidentiality", /confidential|nda|non.?disclosure/i),
    intellectualProperty: obs("intellectualProperty", /intellectual property|\bIP\b|assign(s|ment)?|work for hire|inventions?|creations?|ownership of (work|IP)/i),
    restrictive: obs("restrictive", /non[- ]compete|non[- ]solicit|restrictive covenant|covenant not to compete|post[- ]termination restriction|non[- ]disclosure.*restrict/i),
    liability: obs("liability", /liab|indemnif|hold harmless|damages/i),
    // "unlimited" contains "limit" but means the opposite of a cap: the
    // lookbehind keeps the liability-capacity alternative honest (mirrors freelance/lease/purchase_sale).
    liabilityCap: obs("liabilityCap", /cap(ped)?|limited to|maximum liability|not exceed|liability.{0,40}(?<!un)limit/i),
    benefits: obs("benefits", /benefits?|pension|health insurance|medical|retirement|bonus/i),
    dispute: obs("dispute", /dispute resolution|grievance|arbitrat|mediation|governing law|jurisdiction|employment tribunal|court of/i),
    conflictingPaymentTerms,
    conflictingTimelineTerms,
  }
}
