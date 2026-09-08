// Founder vertical: structured facts (Phase 22).
//
// Deterministic projection of ExtractedData plus raw input into
// founder-meaningful facts. No second extractor, no AI, every
// observed value carries evidence, unobserved stays null (unknown, not false).
// Observation helpers are shared from @/lib/verticals/observe.

import type { ExtractedData } from "@/lib/ai/extract"
import {
  observePattern,
  sectionedParts,
  type ObservedText,
  type ObservationSource,
} from "@/lib/verticals/observe"

export interface FounderFacts {
  founderRoles: ObservedText
  ownershipSplit: ObservedText
  valuation: ObservedText
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
  }
}
