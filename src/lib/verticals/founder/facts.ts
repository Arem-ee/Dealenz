// Founder vertical: structured facts (Phase 22).
//
// Deterministic projection of ExtractedData plus raw input into
// founder-meaningful facts. No second extractor, no AI, every
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

export interface FounderFacts {
  founderRoles: ObservedText
  ownershipSplit: ObservedText
  valuation: ObservedText
  dealValue: ObservedText
  vesting: ObservedText
  governance: ObservedText
  decisionRights: ObservedText
  ipAssignment: ObservedText
  confidentiality: ObservedText
  leaverProvisions: ObservedText
  transferRestrictions: ObservedText
  dilution: ObservedText
  liability: ObservedText
  liabilityCap: ObservedText
  // Structural preservation of conflicting observations (same pattern as
  // freelance/generic): separate budget/timeline terms stay separate.
  conflictingPaymentTerms: ObservedFlag
  conflictingTimelineTerms: ObservedFlag
}

// Pure: same extraction + same raw text + same source → same facts.
export function deriveFounderFacts(
  extracted: ExtractedData,
  rawText?: string,
  source?: ObservationSource
): FounderFacts {
  const src: ObservationSource = source ?? { type: "conversation_input", id: null }
  const parts = sectionedParts(extracted, rawText)
  const key = (field: string) => `facts.founder.${field}`
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

  const dealValueFromBudget = extracted.budget
    ? {
        text: extracted.budget,
        evidence: extracted.budget.slice(0, 200),
        evidenceRefs: [
          makeEvidence({
            sourceType: "extraction",
            sourceId: src.id,
            quote: extracted.budget.slice(0, 200),
            observationKey: key("dealValue"),
            method: "ai_extraction",
            confidence: extracted.confidence,
            inspectable,
            location: { kind: "unavailable" },
          }),
        ],
      }
    : null

  return {
    founderRoles: obs(
      "founderRoles",
      /\b(co-?founders?|CEO|CTO|chief executive|managing director)\b[^\n]{0,60}|founder roles?|job title/i
    ),
    ownershipSplit: obs(
      "ownershipSplit",
      /ownership split|split.{0,24}ownership|equity split|sharehold|owns? \d|percent|cap table|capitali[sz]ation|fully diluted/i
    ),
    valuation: obs("valuation", /valuation|valued at|pre-money|post-money|valuation cap/i),
    dealValue:
      dealValueFromBudget ??
      obs(
        "dealValue",
        /deal value|transaction value|equity value|funding (amount|round)?|investment (amount|size)?|contribution|capital (contribution|investment)|amount of[^\n]{0,40}(?:\$|£|€|USD|GBP|EUR|NGN)/i
      ),
    vesting: obs("vesting", /vesting|vest(ed|s)?\b|cliff|acceleration|reverse vesting/i),
    governance: obs("governance", /governance|board of directors|\bboard\b|deadlock|quorum/i),
    decisionRights: obs(
      "decisionRights",
      /decision rights|reserved matters|veto|consent of|approval of|voting rights/i
    ),
    ipAssignment: obs(
      "ipAssignment",
      /intellectual property|\bIP\b|assign(s|ment)?|inventions?|ownership of (work|IP)/i
    ),
    confidentiality: obs("confidentiality", /confidential|nda|non.?disclosure/i),
    leaverProvisions: obs(
      "leaverProvisions",
      /leaver|good leaver|bad leaver|departure|resignation|removal|repurchase|buy-?back/i
    ),
    transferRestrictions: obs(
      "transferRestrictions",
      /transfer restriction|transfer of shares|share transfers?|right of first refusal|\bROFR\b|drag.?along|tag.?along|pre-emption|lock-?up/i
    ),
    dilution: obs("dilution", /dilution|anti-dilution|option pool|fully diluted/i),
    liability: obs("liability", /liab|indemnif|hold harmless|damages/i),
    // "unlimited" contains "limit" but means the opposite of a cap: the
    // lookbehind keeps the liability-capacity alternative honest (mirrors freelance/lease/purchase_sale/employment).
    liabilityCap: obs("liabilityCap", /cap(ped)?|limited to|maximum liability|not exceed|liability.{0,40}(?<!un)limit/i),
    conflictingPaymentTerms,
    conflictingTimelineTerms,
  }
}
