// Vertical dispatcher (Phase 6).
//
// The vertical is the variable; the intelligence infrastructure is the
// constant. This lookup is the only place that maps a deal type to its
// vertical modules (fact projection, rule pack, knowledge filter). Shared
// layers never import verticals directly; pipelines resolve the pack here
// and otherwise treat every vertical identically. Generic deals now have a
// lightweight deterministic floor (product.md recommendation); unknown
// deal types still resolve to null.

import type { ExtractedData } from "@/lib/ai/extract"
import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"
import type { Rule } from "@/lib/rules/schema"
import type { ObservationSource } from "./observe"
import { deriveFreelanceFacts } from "./freelance/facts"
import { registerFreelancePack } from "./freelance/rules"
import { selectFreelanceCandidates } from "./freelance/knowledge"
import { deriveLeaseFacts } from "./lease/facts"
import { registerLeasePack } from "./lease/rules"
import { selectLeaseCandidates } from "./lease/knowledge"
import { derivePurchaseSaleFacts } from "./purchase_sale/facts"
import { registerPurchaseSalePack } from "./purchase_sale/rules"
import { selectPurchaseSaleCandidates } from "./purchase_sale/knowledge"
import { deriveEmploymentFacts } from "./employment/facts"
import { registerEmploymentPack } from "./employment/rules"
import { selectEmploymentCandidates } from "./employment/knowledge"
import { deriveFounderFacts } from "./founder/facts"
import { registerFounderPack } from "./founder/rules"
import { selectFounderCandidates } from "./founder/knowledge"
import { deriveGenericFacts } from "./generic/facts"
import { registerGenericPack } from "./generic/rules"
import { selectGenericCandidates } from "./generic/knowledge"

export interface VerticalPack {
  key: "freelance" | "lease" | "purchase_sale" | "employment" | "generic" | "founder"
  deriveFacts(extracted: ExtractedData, rawText?: string, source?: ObservationSource): unknown
  registerPack(): Rule[]
  selectCandidates(candidates: KnowledgeCandidate[]): KnowledgeCandidate[]
}

const PACKS: Record<VerticalPack["key"], VerticalPack> = {
  freelance: {
    key: "freelance",
    deriveFacts: deriveFreelanceFacts,
    registerPack: registerFreelancePack,
    selectCandidates: selectFreelanceCandidates,
  },
  lease: {
    key: "lease",
    deriveFacts: deriveLeaseFacts,
    registerPack: registerLeasePack,
    selectCandidates: selectLeaseCandidates,
  },
  purchase_sale: {
    key: "purchase_sale",
    deriveFacts: derivePurchaseSaleFacts,
    registerPack: registerPurchaseSalePack,
    selectCandidates: selectPurchaseSaleCandidates,
  },
  employment: {
    key: "employment",
    deriveFacts: deriveEmploymentFacts,
    registerPack: registerEmploymentPack,
    selectCandidates: selectEmploymentCandidates,
  },
  founder: {
    key: "founder",
    deriveFacts: deriveFounderFacts,
    registerPack: registerFounderPack,
    selectCandidates: selectFounderCandidates,
  },
  generic: {
    key: "generic",
    deriveFacts: deriveGenericFacts,
    registerPack: registerGenericPack,
    selectCandidates: selectGenericCandidates,
  },
}

export function verticalForDealType(dealType: string): VerticalPack | null {
  if (
    dealType === "freelance" ||
    dealType === "lease" ||
    dealType === "purchase_sale" ||
    dealType === "employment" ||
    dealType === "generic" ||
    dealType === "founder"
  )
    return PACKS[dealType]
  return null
}

export function registeredVerticalKeys(): Array<VerticalPack["key"]> {
  return Object.keys(PACKS) as Array<VerticalPack["key"]>
}
