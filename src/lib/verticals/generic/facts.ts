// Generic vertical: lightweight contract-quality facts (AI-authority fix).
// Deterministic projection of ExtractedData + raw text into generic facts.
// No AI, every observed value carries evidence, unobserved stays null.

import type { ExtractedData } from "@/lib/ai/extract"
import { makeEvidence } from "@/lib/evidence/schema"
import {
  observePattern,
  sectionedParts,
  type ObservedText,
  type ObservationSource,
} from "@/lib/verticals/observe"

export interface GenericFacts {
  termination: ObservedText
  governingLaw: ObservedText
  paymentTerms: ObservedText
  liability: ObservedText
  liabilityCap: ObservedText
  disputeResolution: ObservedText
  scope: ObservedText
  amendment: ObservedText
  deliverablesCount: number
}

export function deriveGenericFacts(
  extracted: ExtractedData,
  rawText?: string,
  source?: ObservationSource
): GenericFacts {
  const src: ObservationSource = source ?? { type: "conversation_input", id: null }
  const parts = sectionedParts(extracted, rawText)
  const key = (field: string) => `facts.generic.${field}`
  const obs = (field: string, pattern: RegExp) => observePattern(parts, pattern, { key: key(field), source: src })
  const inspectable = src.type === "audit_input" && src.id !== null

  // Reuse extraction evidence helpers where appropriate? Generic paymentTerms
  // is observed via pattern, not via extracted.budget directly, to keep the
  // floor structural. DeliverablesCount is taken from extraction length.
  return {
    termination: obs("termination", /terminat|cancel(l)?ation|end the agreement|walk away|termination clause/i),
    governingLaw: obs("governingLaw", /governing law|applicable law|choice of law|subject to.*law|jurisdiction|governed by/i),
    paymentTerms: obs("paymentTerms", /payment terms?|consideration|amount payable|price|compensation|fee|net\s*\d+|payment schedule|upon completion|on delivery|milestone\s*payment/i),
    liability: obs("liability", /liab|indemnif|hold harmless|damages/i),
    liabilityCap: obs("liabilityCap", /cap(ped)?|limited to|maximum liability|not exceed|liability.{0,40}(?<!un)limit/i),
    disputeResolution: obs("disputeResolution", /dispute resolution|arbitrat|mediation|small claims|court of|governing law|jurisdiction/i),
    scope: obs("scope", /scope|deliverables?|services|work|obligations|responsibilities|what will be delivered/i),
    amendment: obs("amendment", /unilateral|sole discretion|one-sided|at any time.*amend|may amend.*sole|unilateral.*amend/i),
    deliverablesCount: extracted.deliverables.length,
  }
}
