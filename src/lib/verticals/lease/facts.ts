// Lease vertical: structured facts (Phase 6).
//
// A deterministic projection of the existing ExtractedData plus the raw input
// text into lease-meaningful facts. Same contract as the freelance vertical:
// no second extractor, no AI, every observed value carries evidence, anything
// unobserved stays null (unknown, not false), and rules decide what unknown
// means. Observation helpers are shared from @/lib/verticals/observe.

import type { ExtractedData } from "@/lib/ai/extract"
import { makeEvidence } from "@/lib/evidence/schema"
import {
  observePattern,
  sectionedParts,
  type ObservedFlag,
  type ObservedText,
  type ObservationSource,
} from "@/lib/verticals/observe"

export interface LeaseFacts {
  rent: ObservedText
  paymentFrequency: ObservedText
  deposit: ObservedText
  leaseTerm: ObservedText
  commencement: ObservedText
  expiry: ObservedText
  renewal: ObservedText
  termination: ObservedText
  notice: ObservedText
  rentReview: ObservedText
  maintenance: ObservedText
  repairs: ObservedText
  utilities: ObservedText
  permittedUse: ObservedText
  subletting: ObservedText
  alterations: ObservedText
  insurance: ObservedText
  liability: ObservedText
  liabilityCap: ObservedText
  defaultTerms: ObservedText
  possession: ObservedText
  fixtures: ObservedText
  // Structural preservation of conflicting observations (same pattern as
  // freelance/generic): separate budget/timeline terms stay separate.
  conflictingPaymentTerms: ObservedFlag
  conflictingTimelineTerms: ObservedFlag
}

// Deterministic lease fact projection. Pure: same extraction plus same raw
// text plus same source always yields the same facts. Patterns are
// conservative presence detectors, not a parser and not legal analysis.
// Every affirmative observation carries validated Evidence references.
export function deriveLeaseFacts(
  extracted: ExtractedData,
  rawText?: string,
  source?: ObservationSource
): LeaseFacts {
  const src: ObservationSource = source ?? { type: "conversation_input", id: null }
  const parts = sectionedParts(extracted, rawText)
  const key = (field: string) => `facts.lease.${field}`
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
  return {
    rent: extracted.budget
      ? {
          text: extracted.budget,
          evidence: extracted.budget.slice(0, 200),
          evidenceRefs: [
            makeEvidence({
              sourceType: "extraction",
              sourceId: src.id,
              quote: extracted.budget.slice(0, 200),
              observationKey: key("rent"),
              method: "ai_extraction",
              confidence: extracted.confidence,
              inspectable,
              location: { kind: "unavailable" },
            }),
          ],
        }
      : obs("rent", /rent[^\n]{0,60}|monthly payment[^\n]{0,60}|annual rent[^\n]{0,60}/i),
    paymentFrequency: obs("paymentFrequency", /monthly|quarterly|annually|weekly|per month|per annum|per quarter|per week/i),
    deposit: obs("deposit", /security deposit|deposit of [^\n]{1,60}|deposit equal to[^\n]{0,60}|bond [^\n]{0,40}/i),
    leaseTerm: obs("leaseTerm", /term of [^\n]{1,60}|(\d+)[\s-]+(year|month)s?[^\n]{0,30}?(lease|term|tenancy)|lease term[^\n]{0,60}|fixed term/i),
    commencement: obs("commencement", /commencement|commences|start date|beginning of the term|term begins/i),
    expiry: obs("expiry", /expir(y|ation|es)|end date|end of (the )?term/i),
    renewal: obs("renewal", /renew(al)?|extend|extension|option to renew|holding over/i),
    termination: obs("termination", /terminat|break clause|early termination|notice to quit|surrender|forfeit/i),
    notice: obs("notice", /(\d+)\s*(day|month)s?('?s)? notice|notice of [^\n]{1,60}|notice period/i),
    rentReview: obs("rentReview", /rent review|rent increase|escalation|index-linked|CPI|RPI|market rent|review date/i),
    maintenance: obs("maintenance", /maintenan|upkeep|keeps?( the premises)? in (good )?repair/i),
    repairs: obs("repairs", /repair|dilapidation|disrepair/i),
    utilities: obs("utilities", /utilit|service charge|council tax|business rates/i),
    permittedUse: obs("permittedUse", /permitted use|use (of|as)|purpose of the (lease|tenancy|premises)/i),
    subletting: obs("subletting", /sublet|sub-let|underlet|assign(ment|ing)?|share (of )?possession|part with possession/i),
    alterations: obs("alterations", /alteration|improvement|fit.?out|modif/i),
    insurance: obs("insurance", /insur/i),
    liability: obs("liability", /liab|indemnif|hold harmless|damages/i),
    // "unlimited" contains "limit" but means the opposite of a cap: the
    // lookbehind keeps the liability-capacity alternative honest.
    liabilityCap: obs("liabilityCap", /cap(ped)?|limited to|maximum liability|not exceed|liability.{0,40}(?<!un)limit/i),
    defaultTerms: obs("defaultTerms", /default|breach|forfeit|re-?enter|reentry|arrears|non-payment/i),
    possession: obs("possession", /possession|vacant possession|hand back|yield up|deliver up/i),
    fixtures: obs("fixtures", /fixture|fitting/i),
    conflictingPaymentTerms,
    conflictingTimelineTerms,
  }
}
