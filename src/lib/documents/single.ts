// Single-document generation for plan-based execution.
//
// The inline protection-package path chains all four freelance documents in
// one request (proposal → sow → contract → checklist, each feeding the
// next). Plan steps are independent and resumable by design, so each
// generate_draft step produces ONE document from the deal reference alone —
// no cross-document chaining. Tradeoff, stated plainly: a plan-built
// contract lacks the SOW-draft context the inline path feeds it, in exchange
// for per-step idempotency, progress, retry, and background execution.
// AI-first with honest template fallback; generation_method always records
// what actually happened.

import { callAISurface } from "@/lib/ai/client"
import type { ExtractedData } from "@/lib/ai/extract"
import type { RiskReport } from "@/lib/risk/engine"
import {
  buildChecklistPrompt,
  buildContractPrompt,
  buildProposalPrompt,
  buildSowPrompt,
  referenceBlock,
} from "@/lib/ai/prompts"
import {
  generateChecklist,
  generateContract,
  generateProposal,
  generateSow,
  type DocumentMethod,
} from "@/lib/generate"
import { addBusinessProfileToDocument, type BusinessProfileForDocuments } from "./business-profile"

export const PLAN_GENERATABLE_FAMILIES = ["proposal", "sow", "contract", "checklist"] as const
export type PlanGeneratableFamily = (typeof PLAN_GENERATABLE_FAMILIES)[number]

export function isPlanGeneratableFamily(value: string): value is PlanGeneratableFamily {
  return (PLAN_GENERATABLE_FAMILIES as readonly string[]).includes(value)
}

export interface SingleDocumentInput {
  requestedType: PlanGeneratableFamily
  extractedData: ExtractedData
  riskReport: RiskReport
  businessProfile: BusinessProfileForDocuments | null
}

export async function generateSingleDocument(input: SingleDocumentInput): Promise<{ content: string; method: DocumentMethod }> {
  const dealReference = referenceBlock("extracted-deal-data", JSON.stringify(input.extractedData))
  const systemPrompt =
    input.requestedType === "proposal"
      ? buildProposalPrompt(input.riskReport)
      : input.requestedType === "sow"
        ? buildSowPrompt(input.riskReport)
        : input.requestedType === "contract"
          ? buildContractPrompt(input.riskReport)
          : buildChecklistPrompt()
  try {
    const { text } = await callAISurface("authenticated", { systemPrompt, userContent: dealReference })
    return { content: addBusinessProfileToDocument(text, input.businessProfile), method: "ai" }
  } catch {
    const fallback =
      input.requestedType === "proposal"
        ? generateProposal(input.extractedData)
        : input.requestedType === "sow"
          ? generateSow(input.extractedData, input.riskReport)
          : input.requestedType === "contract"
            ? generateContract(input.extractedData, input.riskReport)
            : generateChecklist(input.extractedData, input.riskReport)
    return { content: addBusinessProfileToDocument(fallback, input.businessProfile), method: "template" }
  }
}
