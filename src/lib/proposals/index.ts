import { buildProposalPlan, type ProposalPlan } from "./plan"
import { generateProposalText } from "./generate"
import { evaluateProposal, type ProposalEvaluation } from "./evaluate"
import type { ContextEnvelope } from "@/lib/context/schema"
import type { ExtractedData } from "@/lib/ai/extract"

export type { ProposalPlan, ProposalComplexity } from "./plan"
export type { ProposalEvaluation } from "./evaluate"

export interface ProposalResult {
  plan: ProposalPlan
  proposal: string
  evaluation: ProposalEvaluation
  refined: boolean
}

export async function generateProposalWithRefinement(input: {
  envelope: ContextEnvelope | null
  extracted: ExtractedData | null
  rawInput?: string | null
}): Promise<ProposalResult> {
  const plan = buildProposalPlan({ envelope: input.envelope, extracted: input.extracted, rawInput: input.rawInput ?? null })
  let proposal = await generateProposalText(plan, input.rawInput ?? null)
  let evaluation = evaluateProposal(plan, proposal)
  let refined = false
  if (evaluation.hasFail && !evaluation.hasUnknown) {
    const retryPlan = { ...plan, assumptions: [...plan.assumptions, `Refinement: address gaps - ${evaluation.gaps.slice(0, 2).join("; ")}`] }
    try {
      const retry = await generateProposalText(retryPlan as ProposalPlan, input.rawInput ?? null)
      const retryEval = evaluateProposal(plan, retry)
      if (!retryEval.hasFail || retryEval.results.filter((r) => r.status === "FAIL").length < evaluation.results.filter((r) => r.status === "FAIL").length) {
        proposal = retry
        evaluation = retryEval
        refined = true
      }
    } catch {}
  }
  if (plan.unresolved.length > 0 && !proposal.toLowerCase().includes("assum")) {
    // surface unresolved honestly - do not hide
  }
  return { plan, proposal, evaluation, refined }
}
