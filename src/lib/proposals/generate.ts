import { callAISurface } from "@/lib/ai/client"
import { maxTokensForOperation } from "@/lib/ai/operations"
import { applyConstitution } from "@/lib/ai/constitution"
import type { ProposalPlan } from "./plan"

function referenceBlock(label: string, content: string): string {
  return `--- ${label} ---\n${content}\n--- end ${label} ---`
}

function buildProposalSystemPrompt(plan: ProposalPlan): string {
  const base = `You are Dealenz proposal writer. Write a proposal in markdown that is clear, specific to the client, commercially coherent, and honest about uncertainty. Use only the context provided. Do not invent client needs, outcomes, statistics, testimonials, or legal claims. Do not use banned phrases world-class, best-in-class, revolutionary, cutting-edge, transformative unless supported. Benefits must be phrased as expected outcomes, not guarantees.`
  const sections = `Required sections for this ${plan.complexity} proposal: ${plan.requiredSections.join(", ")}. Include only those sections.`
  const rules = `Rules: every objective must have a response, every deliverable must explain why it matters, assumptions must be visible, next step must be concrete, do not guarantee outcomes.`
  return applyConstitution(`${base}\n\n${sections}\n\n${rules}`, "proposal" as never)
}

export async function generateProposalText(plan: ProposalPlan, untrustedSource?: string | null): Promise<string> {
  const systemPrompt = buildProposalSystemPrompt(plan)
  const planBlock = referenceBlock("proposal-plan", JSON.stringify({
    complexity: plan.complexity,
    objectives: plan.objectives.map((o) => o.text),
    deliverables: plan.deliverables,
    benefits: plan.benefits,
    commercial: plan.commercial,
    assumptions: plan.assumptions,
    dependencies: plan.dependencies,
    nextStep: plan.nextStep,
    unresolved: plan.unresolved,
    requiredSections: plan.requiredSections,
  }, null, 2))
  const userParts = [planBlock]
  if (untrustedSource && untrustedSource.trim()) {
    userParts.push(referenceBlock("untrusted-source-material", untrustedSource.slice(0, 4000)))
  }
  const userContent = userParts.join("\n\n")
  const { text } = await callAISurface("authenticated", {
    systemPrompt,
    userContent,
    maxTokens: maxTokensForOperation("proposal"),
  })
  return text
}
