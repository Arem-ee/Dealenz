import type { ContextEnvelope } from "@/lib/context/schema"
import type { ExtractedData } from "@/lib/ai/extract"

export type ProposalComplexity = "simple" | "standard" | "ambitious"

export const ALL_PROPOSAL_SECTIONS = [
  "Executive Summary",
  "Current Situation",
  "Desired Future State",
  "Objectives",
  "Proposed Approach",
  "Workstreams",
  "Deliverables",
  "Benefits / Expected Outcomes",
  "Timeline / Milestones",
  "Responsibilities",
  "Dependencies",
  "Risks",
  "Commercial Terms",
  "Success Measures",
  "Assumptions",
  "Next Steps",
] as const

export type ProposalSection = typeof ALL_PROPOSAL_SECTIONS[number]

export interface ProposalPlan {
  complexity: ProposalComplexity
  requiredSections: ProposalSection[]
  objectives: Array<{ text: string; source: "extracted" | "inferred" | "unknown" }>
  deliverables: Array<{ title: string; whyItMatters: string | null }>
  benefits: Array<{ text: string; groundedIn: string | null; isGuarantee: boolean }>
  commercial: {
    price: string | null
    paymentStructure: string | null
    currency: string | null
    timeline: string | null
    scopeSummary: string | null
  }
  assumptions: string[]
  dependencies: string[]
  responsibilities: string[]
  risks: string[]
  successMeasures: string[]
  nextStep: string | null
  unresolved: string[]
  jurisdiction: string | null
}

function inferComplexity(opts: { deliverableCount: number; timeline?: string | null; budget?: string | null; goalsCount: number; missingCount: number }): ProposalComplexity {
  let score = 0
  if (opts.deliverableCount >= 5) score += 2
  else if (opts.deliverableCount >= 3) score += 1
  if (opts.goalsCount >= 3) score += 1
  if (opts.timeline && /month|quarter|phase|milestone/i.test(opts.timeline)) score += 1
  if (opts.budget && /(k|000|usd|gbp|eur|\$|£|€)/i.test(opts.budget)) {
    const num = parseInt(opts.budget.replace(/[^0-9]/g, "") || "0", 10)
    if (num >= 20000) score += 2
    else if (num >= 5000) score += 1
  }
  if (opts.missingCount >= 3) score += 1
  if (score >= 4) return "ambitious"
  if (score >= 2) return "standard"
  return "simple"
}

function requiredSectionsFor(complexity: ProposalComplexity): ProposalSection[] {
  if (complexity === "simple") {
    return ["Objectives", "Deliverables", "Benefits / Expected Outcomes", "Commercial Terms", "Next Steps"]
  }
  if (complexity === "standard") {
    return ["Executive Summary", "Current Situation", "Objectives", "Proposed Approach", "Deliverables", "Benefits / Expected Outcomes", "Timeline / Milestones", "Commercial Terms", "Assumptions", "Next Steps"]
  }
  return [...ALL_PROPOSAL_SECTIONS]
}

export function buildProposalPlan(input: {
  envelope: ContextEnvelope | null
  extracted: ExtractedData | null
  rawInput?: string | null
}): ProposalPlan {
  const extracted = input.extracted
  const envelope = input.envelope

  const objectives: ProposalPlan["objectives"] = (extracted?.goals ?? []).map((g) => ({ text: g, source: "extracted" as const }))
  if (objectives.length === 0 && envelope?.fields.priorities.value) {
    for (const p of envelope.fields.priorities.value) {
      objectives.push({ text: p.replace(/_/g, " "), source: "inferred" as const })
    }
  }

  const deliverables = (extracted?.deliverables ?? []).map((d) => ({
    title: d,
    whyItMatters: null as string | null,
  }))

  const benefits: ProposalPlan["benefits"] = []
  for (const g of objectives.slice(0, 3)) {
    benefits.push({ text: `Improved outcome for: ${g.text}`, groundedIn: g.text, isGuarantee: false })
  }

  const jurisdiction = envelope?.fields.jurisdiction.value ?? null

  const unresolved: string[] = []
  if (extracted?.missingInformation) unresolved.push(...extracted.missingInformation)
  if (!extracted?.budget) unresolved.push("commercial terms (price/payment)")
  if (!extracted?.timeline) unresolved.push("timeline / milestones")
  if (objectives.length === 0) unresolved.push("client objectives")

  const complexity = inferComplexity({
    deliverableCount: deliverables.length,
    timeline: extracted?.timeline ?? null,
    budget: extracted?.budget ?? null,
    goalsCount: objectives.length,
    missingCount: unresolved.length,
  })

  const requiredSections = requiredSectionsFor(complexity)

  const commercial = {
    price: extracted?.budget ?? null,
    paymentStructure: null,
    currency: envelope?.fields.transactionCurrency.value ?? null,
    timeline: extracted?.timeline ?? null,
    scopeSummary: deliverables.map((d) => d.title).join(", ") || null,
  }

  const assumptions: string[] = []
  if (unresolved.length > 0) assumptions.push(`Assumes client will confirm: ${unresolved.slice(0, 3).join(", ")}`)
  const dependencies: string[] = complexity === "ambitious" ? ["Client timely feedback and approvals", "Access to required materials and systems"] : []
  const responsibilities: string[] = complexity === "ambitious" ? ["Client: provide timely feedback and required access", "Dealenz user: deliver per agreed scope and timeline"] : []
  const risks: string[] = []
  const successMeasures: string[] = objectives.slice(0, 2).map((o) => `Progress toward: ${o.text}`)

  const nextStep = "Review this proposal and confirm next steps. Upon approval, we will share the service agreement and schedule kickoff."

  return {
    complexity,
    requiredSections,
    objectives,
    deliverables,
    benefits,
    commercial,
    assumptions,
    dependencies,
    responsibilities,
    risks,
    successMeasures,
    nextStep,
    unresolved,
    jurisdiction,
  }
}
