// Vertical dispatcher (Phase 6).
//
// The vertical is the variable; the intelligence infrastructure is the
// constant. This lookup is the only place that maps a deal type to its
// vertical modules (fact projection, rule pack, knowledge filter). Shared
// layers never import verticals directly; pipelines resolve the pack here
// and otherwise treat every vertical identically. Generic deals have no pack:
// builtin generic rules still evaluate.

import type { ExtractedData } from "@/lib/ai/extract"
import type { KnowledgeCandidate } from "@/lib/knowledge/resolver"
import type { Rule } from "@/lib/rules/schema"
import { deriveFreelanceFacts } from "./freelance/facts"
import { registerFreelancePack } from "./freelance/rules"
import { selectFreelanceCandidates } from "./freelance/knowledge"
import { deriveLeaseFacts } from "./lease/facts"
import { registerLeasePack } from "./lease/rules"
import { selectLeaseCandidates } from "./lease/knowledge"

export interface VerticalPack {
  key: "freelance" | "lease"
  deriveFacts(extracted: ExtractedData, rawText?: string): unknown
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
}

export function verticalForDealType(dealType: string): VerticalPack | null {
  if (dealType === "freelance" || dealType === "lease") return PACKS[dealType]
  return null
}

export function registeredVerticalKeys(): Array<VerticalPack["key"]> {
  return Object.keys(PACKS) as Array<VerticalPack["key"]>
}
