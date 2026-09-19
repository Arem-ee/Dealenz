// Purchase/Sale vertical: structured facts (Phase 13).
//
// Deterministic projection of ExtractedData plus raw input into
// purchase/sale-meaningful facts. No second extractor, no AI, every
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

export interface PurchaseSaleFacts {
  asset: ObservedText
  purchasePrice: ObservedText
  currency: ObservedText
  paymentStructure: ObservedText
  deposit: ObservedText
  completionDate: ObservedText
  delivery: ObservedText
  titleTransfer: ObservedText
  inspection: ObservedText
  warranties: ObservedText
  taxesFees: ObservedText
  riskOfLoss: ObservedText
  termination: ObservedText
  defaultTerms: ObservedText
  liability: ObservedText
  liabilityCap: ObservedText
  // Structural preservation of conflicting observations (same pattern as
  // freelance/generic): separate budget/timeline terms stay separate.
  conflictingPaymentTerms: ObservedFlag
  conflictingTimelineTerms: ObservedFlag
}

// Pure: same extraction + same raw text + same source → same facts.
export function derivePurchaseSaleFacts(
  extracted: ExtractedData,
  rawText?: string,
  source?: ObservationSource
): PurchaseSaleFacts {
  const src: ObservationSource = source ?? { type: "conversation_input", id: null }
  const parts = sectionedParts(extracted, rawText)
  const key = (field: string) => `facts.purchase_sale.${field}`
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

  const priceFromExtraction = extracted.budget
    ? {
        text: extracted.budget,
        evidence: extracted.budget.slice(0, 200),
        evidenceRefs: [
          makeEvidence({
            sourceType: "extraction",
            sourceId: src.id,
            quote: extracted.budget.slice(0, 200),
            observationKey: key("purchasePrice"),
            method: "ai_extraction",
            confidence: extracted.confidence,
            inspectable,
            location: { kind: "unavailable" },
          }),
        ],
      }
    : null

  return {
    asset: obs("asset", /asset|item|goods|property|business|shares?|equipment|vehicle|inventory/i),
    purchasePrice: priceFromExtraction ?? obs("purchasePrice", /purchase price|sale price|price of [^\n]{1,40}|amount of [^\n]{1,40}/i),
    currency: obs("currency", /\b(USD|EUR|NGN|GBP|GHS|KES|ZAR|CAD|AUD)\b/),
    paymentStructure: obs("paymentStructure", /payment (terms|schedule|structure)|installments?|on (delivery|completion)|upon (delivery|completion)|milestone payment/i),
    deposit: obs("deposit", /deposit|down payment|earnest money|advance payment/i),
    completionDate: obs("completionDate", /completion date|closing date|completion on|delivery date|handover date|transfer date/i),
    delivery: obs("delivery", /delivery|possession|handover|shipment|pickup/i),
    titleTransfer: obs("titleTransfer", /title (transfer|passes|convey)|ownership (transfer|passes)|transfer of (title|ownership)/i),
    inspection: obs("inspection", /inspect|acceptance|examin(e|ation)|condition report|due diligence/i),
    warranties: obs("warranties", /warrant(y|ies)|representation|guarantee|as[- ]is/i),
    taxesFees: obs("taxesFees", /tax(es)?|fees?|cost allocation|closing costs|stamp duty|VAT/i),
    riskOfLoss: obs("riskOfLoss", /risk of loss|risk passes|loss or damage/i),
    termination: obs("termination", /terminat|cancel(l)?ation|rescission|right to cancel|cooling off/i),
    defaultTerms: obs("defaultTerms", /default|breach|remed(y|ies)|forfeit|non-payment|failure to (pay|deliver)/i),
    liability: obs("liability", /liab|indemnif|hold harmless|damages/i),
    liabilityCap: obs("liabilityCap", /cap(ped)?|limited to|maximum liability|not exceed|liability.{0,40}(?<!un)limit/i),
    conflictingPaymentTerms,
    conflictingTimelineTerms,
  }
}
