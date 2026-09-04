import { callAISurface, type AISurface } from "@/lib/ai/client"
import type { ExtractedData } from "@/lib/ai/extract"
import type { RiskReport, RiskCategory } from "@/lib/risk/engine"
import { buildProposalPrompt, buildSowPrompt, buildContractPrompt, buildChecklistPrompt } from "@/lib/ai/prompts"

export type DocumentType = "proposal" | "sow" | "contract" | "checklist"
export type DocumentMethod = "ai" | "template"

export interface GeneratedDocument {
  id: string
  type: DocumentType
  title: string
  content: string
  createdAt: string
}

export type GeneratedDocMap = Record<DocumentType, { content: string; method: DocumentMethod }>

function revLimit(revisionRisk: RiskCategory): string {
  if (revisionRisk.severity === "high") {
    return "Two (2) rounds of revisions are included in the quoted price. Each revision round includes up to one full review cycle. Any additional revisions, or changes beyond the original scope of work, will require a separate change request and may incur additional charges at the standard hourly rate."
  }
  if (revisionRisk.severity === "medium") {
    return "Up to three (3) rounds of revisions are included. Additional revision rounds will be billed at the agreed hourly rate. Major changes to scope require a separate change order."
  }
  return "Reasonable revisions to final deliverables are included to ensure satisfaction. Significant scope changes or excessive revision cycles may be subject to additional charges."
}

function paymentTerms(paymentRisk: RiskCategory): string {
  if (paymentRisk.severity === "high" || paymentRisk.severity === "medium") {
    return "Payment Schedule:\n- 40% upfront upon agreement signing\n- 30% upon completion of milestone 1 (midpoint)\n- 30% upon final delivery and approval\n\nAll payments are due within 15 days of invoice date. Late payments may incur a 1.5% monthly service charge."
  }
  return "Payment Schedule:\n- 50% upfront upon agreement signing\n- 50% upon final delivery and approval\n\nAll payments are due within 30 days of invoice date."
}

function scopeProtection(scopeRisk: RiskCategory): string {
  if (scopeRisk.severity === "high") {
    return "Any work outside the explicitly defined deliverables listed in the Scope of Work section above shall be considered out-of-scope and will require a separate Change Order. No out-of-scope work will be performed without prior written approval. The Contractor reserves the right to decline scope changes that materially affect the project timeline or budget."
  }
  if (scopeRisk.severity === "medium") {
    return "Changes to the defined scope of work must be submitted in writing and agreed upon by both parties before implementation. Significant scope changes may affect the project timeline and budget."
  }
  return "Any changes to the agreed scope of work will be documented and agreed upon before implementation."
}

function terminationClause(): string {
  return "Either party may terminate this agreement with 14 days written notice. In the event of termination, the Client shall pay for all work completed up to the date of termination, including any non-refundable deposits. Upon termination and payment, the Contractor shall deliver all work product completed to date."
}

function liabilityClause(): string {
  return "The Contractor's total liability arising from this agreement shall not exceed the total fees paid by the Client under this agreement. The Contractor shall not be liable for any indirect, incidental, or consequential damages. The Client acknowledges that the Contractor's services are provided on a professional basis and no outcome is guaranteed unless explicitly stated."
}

function ipClause(ipRisk: RiskCategory): string {
  if (ipRisk.severity === "high" || ipRisk.severity === "medium") {
    return "Upon full payment of all fees due under this agreement, the Contractor assigns to the Client all rights, title, and interest in the final delivered work product. The Contractor retains the right to (a) display the work in their portfolio, (b) reuse non-project-specific code, frameworks, and methodologies, and (c) use the work for self-promotion purposes unless otherwise agreed in writing. Any pre-existing intellectual property owned by either party remains the property of that party."
  }
  return "Upon full payment, all rights to the final deliverables are transferred to the Client. The Contractor retains the right to display work in their portfolio."
}

function generateProposal(data: ExtractedData): string {
  const lines: string[] = []
  lines.push("# Proposal")
  lines.push("")
  lines.push(`## Project: ${data.projectType || "Professional Services"}`)
  lines.push("")
  lines.push("## Client Overview")
  lines.push("Based on the information provided, this proposal outlines a professional engagement tailored to the specific needs and requirements identified during our initial discussions.")
  lines.push("")
  lines.push("## Project Goals")
  if (data.goals.length > 0) {
    data.goals.forEach((g) => lines.push(`- ${g}`))
  } else {
    lines.push("- To be defined in collaboration with the client")
  }
  lines.push("")
  lines.push("## Value Proposition")
  lines.push("Our approach combines professional expertise with a structured delivery framework designed to ensure quality, transparency, and successful outcomes. Every project is backed by clear scope definition, milestone tracking, and quality assurance processes.")
  lines.push("")
  lines.push("## Project Scope")
  if (data.deliverables.length > 0) {
    lines.push("The scope of this engagement includes:")
    data.deliverables.forEach((d) => lines.push(`- ${d}`))
  } else {
    lines.push("Scope details to be finalized during the project kickoff phase.")
  }
  lines.push("")
  lines.push("## Timeline")
  lines.push(data.timeline || "Timeline to be agreed upon during project kickoff.")
  lines.push("")
  lines.push("## Investment")
  lines.push("[Pricing details to be inserted based on scope, timeline, and complexity]")
  lines.push("")
  lines.push("## Next Steps")
  lines.push("1. Review and approve this proposal")
  lines.push("2. Sign the accompanying Service Agreement")
  lines.push("3. Submit initial payment to begin work")
  lines.push("4. Schedule project kickoff meeting")
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("*This proposal is valid for 14 days from the date of issuance.*")
  return lines.join("\n")
}

function generateSow(data: ExtractedData, report: RiskReport): string {
  const lines: string[] = []
  lines.push("# Scope of Work")
  lines.push("")
  lines.push("## Deliverables")
  if (data.deliverables.length > 0) {
    data.deliverables.forEach((d, i) => lines.push(`${i + 1}. ${d}`))
  } else {
    lines.push("Deliverables to be defined and agreed upon during project kickoff.")
  }
  lines.push("")
  lines.push("## Assumptions")
  lines.push("- The Client will provide timely feedback and approvals within agreed turnaround times.")
  lines.push("- The Client will provide all necessary materials, content, and access required for the work.")
  lines.push("- Any third-party costs (stock assets, licenses, etc.) are not included unless specified.")
  lines.push("- The project will be delivered based on the information available at the time of agreement.")
  lines.push("")
  lines.push("## Exclusions")
  lines.push("The following are explicitly excluded from this scope of work:")
  lines.push("- Ongoing maintenance or support beyond the project delivery phase")
  lines.push("- Training or documentation not explicitly listed as deliverables")
  lines.push("- Work not explicitly listed in the Deliverables section above")
  lines.push("- Revisions beyond the agreed revision limits")
  lines.push("")
  lines.push("## Milestones")
  if (data.timeline) {
    lines.push(`Timeline: ${data.timeline}`)
  }
  lines.push("1. Project kickoff and requirements finalization")
  lines.push("2. Initial delivery / first draft")
  lines.push("3. Revision and feedback cycle")
  lines.push("4. Final delivery and approval")
  lines.push("")
  lines.push("## Revision Limits")
  lines.push(revLimit(report.categories.revisionRisk))
  lines.push("")
  lines.push("## Change Request Process")
  lines.push("Any changes to the scope of work must be submitted in writing via a Change Request. The Contractor will assess the impact on timeline and budget and provide a written estimate. No change work shall begin without written approval from both parties.")
  lines.push("")
  if (report.categories.scopeRisk.severity !== "low") {
    lines.push("## Scope Protection")
    lines.push(scopeProtection(report.categories.scopeRisk))
    lines.push("")
  }
  return lines.join("\n")
}

function generateContract(data: ExtractedData, report: RiskReport): string {
  const lines: string[] = []
  lines.push("# Professional Services Agreement")
  lines.push("")
  lines.push("This Agreement is entered into between the Client and the Service Provider for the provision of professional services as described in the accompanying Scope of Work.")
  lines.push("")
  lines.push("## Payment Terms")
  lines.push(paymentTerms(report.categories.paymentRisk))
  lines.push("")
  lines.push("## Termination")
  lines.push(terminationClause())
  lines.push("")
  lines.push("## Limitation of Liability")
  lines.push(liabilityClause())
  lines.push("")
  lines.push("## Intellectual Property")
  lines.push(ipClause(report.categories.ipRisk))
  lines.push("")
  lines.push("## Revision Terms")
  lines.push(revLimit(report.categories.revisionRisk))
  lines.push("")
  lines.push("## Scope Protection")
  lines.push(scopeProtection(report.categories.scopeRisk))
  lines.push("")
  lines.push("## General Provisions")
  lines.push("- This agreement constitutes the entire understanding between the parties.")
  lines.push("- Any modifications must be in writing and signed by both parties.")
  lines.push("- This agreement shall be governed by the laws of [Jurisdiction].")
  lines.push("- Any disputes shall be resolved through good-faith negotiations before pursuing legal remedies.")
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("*This is a template agreement and does not constitute legal advice. Review with your legal counsel before signing.*")
  return lines.join("\n")
}

function generateChecklist(data: ExtractedData, report: RiskReport): string {
  const lines: string[] = []
  lines.push("# Deliverables Checklist")
  lines.push("")
  lines.push("Use this checklist to track delivery and acceptance of all project deliverables.")
  lines.push("")
  lines.push("## Milestone 1: Project Kickoff")
  lines.push("- [ ] Project requirements documented and approved")
  lines.push("- [ ] Timeline and milestones confirmed")
  lines.push("- [ ] Communication channels established")
  lines.push("- [ ] Feedback process defined")
  lines.push("")
  lines.push("## Project Deliverables")
  if (data.deliverables.length > 0) {
    data.deliverables.forEach((d) => {
      lines.push(`- [ ] ${d}`)
      lines.push(`  - Completion criteria: Deliverable meets agreed specifications and has been reviewed by the Client`)
    })
  } else {
    lines.push("- [ ] Deliverable 1 — [description]")
    lines.push("  - Completion criteria: [to be defined]")
    lines.push("- [ ] Deliverable 2 — [description]")
    lines.push("  - Completion criteria: [to be defined]")
  }
  lines.push("")
  lines.push("## Milestone 2: Revisions")
  lines.push("- [ ] Revision round 1 completed")
  lines.push(`- [ ] Revision round 2 completed ${report.categories.revisionRisk.severity === "high" ? "(final)" : ""}`)
  if (report.categories.revisionRisk.severity === "low") {
    lines.push("- [ ] Revision round 3 completed")
  }
  lines.push("")
  lines.push("## Milestone 3: Project Completion")
  lines.push("- [ ] All deliverables delivered and approved")
  lines.push("- [ ] Final payment processed")
  lines.push("- [ ] All assets transferred to Client")
  lines.push("- [ ] Project documentation handed over")
  return lines.join("\n")
}

export async function generateDocuments(
  data: ExtractedData,
  report: RiskReport,
  surface: AISurface = "authenticated"
): Promise<GeneratedDocMap> {
  // 1. Proposal — no prior documents needed
  let proposalContent: string
  let proposalMethod: DocumentMethod
  try {
    const { text } = await callAISurface(surface, {
      systemPrompt: buildProposalPrompt(data, report),
      userContent: JSON.stringify({ goals: data.goals, deliverables: data.deliverables, timeline: data.timeline, budget: data.budget, projectType: data.projectType }),
    })
    proposalContent = text
    proposalMethod = "ai"
  } catch (err) {
    console.error("Proposal generation via AI failed, using template:", err instanceof Error ? err.message : err)
    proposalContent = generateProposal(data)
    proposalMethod = "template"
  }

  // 2. SOW — builds on proposal
  let sowContent: string
  let sowMethod: DocumentMethod
  try {
    const { text } = await callAISurface(surface, {
      systemPrompt: buildSowPrompt(data, report, proposalContent),
      userContent: JSON.stringify({ goals: data.goals, deliverables: data.deliverables, timeline: data.timeline, budget: data.budget, projectType: data.projectType }),
    })
    sowContent = text
    sowMethod = "ai"
  } catch (err) {
    console.error("SOW generation via AI failed, using template:", err instanceof Error ? err.message : err)
    sowContent = generateSow(data, report)
    sowMethod = "template"
  }

  // 3. Contract — builds on proposal + SOW
  let contractContent: string
  let contractMethod: DocumentMethod
  try {
    const { text } = await callAISurface(surface, {
      systemPrompt: buildContractPrompt(data, report, proposalContent, sowContent),
      userContent: JSON.stringify({ goals: data.goals, deliverables: data.deliverables, timeline: data.timeline, budget: data.budget, projectType: data.projectType }),
    })
    contractContent = text
    contractMethod = "ai"
  } catch (err) {
    console.error("Contract generation via AI failed, using template:", err instanceof Error ? err.message : err)
    contractContent = generateContract(data, report)
    contractMethod = "template"
  }

  // 4. Checklist — builds on all prior documents
  let checklistContent: string
  let checklistMethod: DocumentMethod
  try {
    const { text } = await callAISurface(surface, {
      systemPrompt: buildChecklistPrompt(data, report, proposalContent, sowContent, contractContent),
      userContent: JSON.stringify({ goals: data.goals, deliverables: data.deliverables, timeline: data.timeline }),
    })
    checklistContent = text
    checklistMethod = "ai"
  } catch (err) {
    console.error("Checklist generation via AI failed, using template:", err instanceof Error ? err.message : err)
    checklistContent = generateChecklist(data, report)
    checklistMethod = "template"
  }

  return {
    proposal: { content: proposalContent, method: proposalMethod },
    sow: { content: sowContent, method: sowMethod },
    contract: { content: contractContent, method: contractMethod },
    checklist: { content: checklistContent, method: checklistMethod },
  }
}
