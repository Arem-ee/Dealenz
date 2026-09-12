// Partnership vertical: structured facts (Phase 25).
//
// Deterministic projection of ExtractedData plus raw input into
// partnership-meaningful facts. No second extractor, no AI, every
// observed value carries evidence, unobserved stays null (unknown, not false).
// Observation helpers are shared from @/lib/verticals/observe.

import type { ExtractedData } from "@/lib/ai/extract"
import {
  observePattern,
  sectionedParts,
  type ObservedText,
  type ObservationSource,
} from "@/lib/verticals/observe"

export interface PartnershipFacts {
  partnershipStructure: ObservedText
  partnerRoles: ObservedText
  contributions: ObservedText
  ownershipSplit: ObservedText
  capitalCalls: ObservedText
  governance: ObservedText
  decisionRights: ObservedText
  managementAuthority: ObservedText
  profitDistribution: ObservedText
  liability: ObservedText
  liabilityCap: ObservedText
  termDissolution: ObservedText
  exitBuyout: ObservedText
  transferRestrictions: ObservedText
  disputeResolution: ObservedText
  ipAssignment: ObservedText
  confidentiality: ObservedText
}

// Pure: same extraction + same raw text + same source → same facts.
export function derivePartnershipFacts(
  extracted: ExtractedData,
  rawText?: string,
  source?: ObservationSource
): PartnershipFacts {
  const src: ObservationSource = source ?? { type: "conversation_input", id: null }
  const parts = sectionedParts(extracted, rawText)
  const key = (field: string) => `facts.partnership.${field}`
  const obs = (field: string, pattern: RegExp) => observePattern(parts, pattern, { key: key(field), source: src })

  return {
    partnershipStructure: obs(
      "partnershipStructure",
      /\b(LLP|limited liability partnership|limited partnership|\bLP\b|ordinary partnership|general partnership)\b/i
    ),
    partnerRoles: obs(
      "partnerRoles",
      /\b(general partner|limited partner|managing partner|partners)\b[^\n]{0,60}|partner roles?/i
    ),
    contributions: obs(
      "contributions",
      /capital contributions?|initial contributions?|contributes?|contributed|in-kind contribution/i
    ),
    ownershipSplit: obs(
      "ownershipSplit",
      /ownership split|split.{0,24}ownership|split.{0,24}profits?|equity split|profit.{0,24}split|profit sharing|sharehold|owns? \d|percent|shares? of (profit|loss)/i
    ),
    capitalCalls: obs(
      "capitalCalls",
      /capital calls?|additional contributions?|future funding|additional capital|funding obligations?/i
    ),
    governance: obs(
      "governance",
      /governance|voting|votes? per|majority vote|unanimous|deadlock|quorum/i
    ),
    decisionRights: obs(
      "decisionRights",
      /decision rights|reserved matters|veto|consent of|approval of|voting rights|authority to bind|bind the partnership/i
    ),
    managementAuthority: obs(
      "managementAuthority",
      /managing partner|day-to-day|manage the (business|partnership|affairs)|operational control/i
    ),
    profitDistribution: obs(
      "profitDistribution",
      /profit distribution|distribut\w*|\bdraws?\b|drawings|allocation of (profit|loss)|allocated (profit|loss)/i
    ),
    liability: obs(
      "liability",
      /liab|indemnif|hold harmless|damages|jointly and severally|joint and several/i
    ),
    // "unlimited" contains "limit" but means the opposite of a cap: the
    // lookbehind keeps the liability-capacity alternative honest (mirrors freelance/lease/purchase_sale/employment/founder).
    liabilityCap: obs("liabilityCap", /cap(ped)?|limited to|maximum liability|not exceed|liability.{0,40}(?<!un)limit/i),
    termDissolution: obs(
      "termDissolution",
      /dissolution|dissolve|term of (the )?partnership|duration|winding up|wind up|liquidat/i
    ),
    exitBuyout: obs(
      "exitBuyout",
      /buy-?sell|buyout|buy-?out|withdrawal|retirement of (a )?partner|expulsion|departing partner|valuation on exit/i
    ),
    transferRestrictions: obs(
      "transferRestrictions",
      /transfer restriction|transfer of (partnership )?interests?|transferring (an )?interests?|assignment of interest|right of first refusal|\bROFR\b|consent to transfer|admission of (new )?partners?/i
    ),
    disputeResolution: obs(
      "disputeResolution",
      /dispute resolution|disputes?|mediation|arbitration/i
    ),
    ipAssignment: obs(
      "ipAssignment",
      /intellectual property|\bIP\b|assign(s|ment)?|inventions?|ownership of (work|IP)/i
    ),
    confidentiality: obs("confidentiality", /confidential|nda|non.?disclosure/i),
  }
}
