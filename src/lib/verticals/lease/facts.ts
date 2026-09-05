// Lease vertical: structured facts (Phase 6).
//
// A deterministic projection of the existing ExtractedData plus the raw input
// text into lease-meaningful facts. Same contract as the freelance vertical:
// no second extractor, no AI, every observed value carries evidence, anything
// unobserved stays null (unknown, not false), and rules decide what unknown
// means. Observation helpers are shared from @/lib/verticals/observe.

import type { ExtractedData } from "@/lib/ai/extract"
import { corpusOf, text, type ObservedText } from "@/lib/verticals/observe"

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
}

// Deterministic lease fact projection. Pure: same extraction plus same raw
// text always yields the same facts. Patterns are conservative presence
// detectors, not a parser and not legal analysis.
export function deriveLeaseFacts(extracted: ExtractedData, rawText?: string): LeaseFacts {
  const corpus = corpusOf(extracted, rawText)
  return {
    rent: extracted.budget
      ? { text: extracted.budget, evidence: extracted.budget.slice(0, 200) }
      : text(corpus, /rent[^\n]{0,60}|monthly payment[^\n]{0,60}|annual rent[^\n]{0,60}/i),
    paymentFrequency: text(corpus, /monthly|quarterly|annually|weekly|per month|per annum|per quarter|per week/i),
    deposit: text(corpus, /security deposit|deposit of [^\n]{1,60}|deposit equal to[^\n]{0,60}|bond [^\n]{0,40}/i),
    leaseTerm: text(corpus, /term of [^\n]{1,60}|(\d+)[\s-]+(year|month)s?[^\n]{0,30}?(lease|term|tenancy)|lease term[^\n]{0,60}|fixed term/i),
    commencement: text(corpus, /commencement|commences|start date|beginning of the term|term begins/i),
    expiry: text(corpus, /expir(y|ation|es)|end date|end of (the )?term/i),
    renewal: text(corpus, /renew(al)?|extend|extension|option to renew|holding over/i),
    termination: text(corpus, /terminat|break clause|early termination|notice to quit|surrender|forfeit/i),
    notice: text(corpus, /(\d+)\s*(day|month)s?('?s)? notice|notice of [^\n]{1,60}|notice period/i),
    rentReview: text(corpus, /rent review|rent increase|escalation|index-linked|CPI|RPI|market rent|review date/i),
    maintenance: text(corpus, /maintenan|upkeep|keeps?( the premises)? in (good )?repair/i),
    repairs: text(corpus, /repair|dilapidation|disrepair/i),
    utilities: text(corpus, /utilit|service charge|council tax|business rates/i),
    permittedUse: text(corpus, /permitted use|use (of|as)|purpose of the (lease|tenancy|premises)/i),
    subletting: text(corpus, /sublet|sub-let|underlet|assign(ment|ing)?|share (of )?possession|part with possession/i),
    alterations: text(corpus, /alteration|improvement|fit.?out|modif/i),
    insurance: text(corpus, /insur/i),
    liability: text(corpus, /liab|indemnif|hold harmless|damages/i),
    // "unlimited" contains "limit" but means the opposite of a cap: the
    // lookbehind keeps the liability-capacity alternative honest.
    liabilityCap: text(corpus, /cap(ped)?|limited to|maximum liability|not exceed|liability.{0,40}(?<!un)limit/i),
    defaultTerms: text(corpus, /default|breach|forfeit|re-?enter|reentry|arrears|non-payment/i),
    possession: text(corpus, /possession|vacant possession|hand back|yield up|deliver up/i),
    fixtures: text(corpus, /fixture|fitting/i),
  }
}
