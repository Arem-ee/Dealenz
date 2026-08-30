import type { ExtractedData } from "@/lib/ai/extract"

export interface RiskFinding {
  title: string
  description: string
  evidence: string
}

export interface RiskCategory {
  score: number
  severity: "low" | "medium" | "high"
  findings: RiskFinding[]
  mitigations: string
}

export interface RiskReport {
  overallScore: number
  riskLevel: "Low" | "Medium" | "High"
  categories: {
    scopeRisk: RiskCategory
    paymentRisk: RiskCategory
    timelineRisk: RiskCategory
    communicationRisk: RiskCategory
    revisionRisk: RiskCategory
    legalRisk: RiskCategory
    ipRisk: RiskCategory
    clientBehaviorRisk: RiskCategory
  }
  summary: string
  recommendations: string[]
}

function severityFromScore(score: number): "low" | "medium" | "high" {
  if (score >= 80) return "low"
  if (score >= 50) return "medium"
  return "high"
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function matchAny(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return m[0]
  }
  return null
}

function matchSignals(signals: string[], patterns: RegExp[]): string[] {
  return signals
    .map((s) => {
      const match = matchAny(s, patterns)
      return match ? s : null
    })
    .filter((s): s is string => s !== null)
}

function evaluateScopeRisk(data: ExtractedData): RiskCategory {
  const findings: RiskFinding[] = []
  let score = 100

  const scopePatterns = [
    /vague|unclear|undefined|scope creep/i,
    /additional work|extra|might need|possibly|maybe/i,
    /hidden|unspoken|assumptions/i,
  ]

  const matched = matchSignals(data.clientSignals, scopePatterns)
  if (matched.length > 0) {
    score -= matched.length * 15
    findings.push({
      title: matched.length > 1 ? "Multiple scope indicators detected" : "Scope indicator detected",
      description: "Client signals suggest unclear or expanding scope boundaries.",
      evidence: matched.join("; "),
    })
  }

  if (data.deliverables.length === 0) {
    score -= 30
    findings.push({
      title: "No deliverables defined",
      description: "No specific deliverables were mentioned in the project description.",
      evidence: "Deliverables field is empty",
    })
  } else if (data.deliverables.length <= 2) {
    score -= 10
    findings.push({
      title: "Few deliverables specified",
      description: "Only a small number of deliverables were listed, which may indicate incomplete scope definition.",
      evidence: `${data.deliverables.length} deliverable(s) listed`,
    })
  }

  const scopeMissingInfo = data.missingInformation.filter(
    (m) => /scope|deliverable|boundar|requirement|specific/i.test(m)
  )
  if (scopeMissingInfo.length > 0) {
    score -= scopeMissingInfo.length * 10
    findings.push({
      title: "Scope information gaps",
      description: "Important scope-related information is missing.",
      evidence: scopeMissingInfo.join("; "),
    })
  }

  if (data.goals.length === 0) {
    score -= 15
    findings.push({
      title: "No project goals identified",
      description: "Without clear goals, scope boundaries are difficult to define.",
      evidence: "Goals field is empty",
    })
  }

  return {
    score: clampScore(score),
    severity: severityFromScore(score),
    findings,
    mitigations: findings.length > 0
      ? "Define specific deliverables in writing. Include a scope clause with clear boundaries. Add a change order process for out-of-scope requests."
      : "Continue maintaining clear scope definitions in your agreement.",
  }
}

function evaluatePaymentRisk(data: ExtractedData): RiskCategory {
  const findings: RiskFinding[] = []
  let score = 100

  if (!data.budget) {
    score -= 40
    findings.push({
      title: "No budget specified",
      description: "The project has no mentioned budget or payment structure.",
      evidence: "Budget field is empty",
    })
  } else {
    const vagueBudget = /competitive|market rate|exposure|equity|negotiable/i.test(data.budget)
    if (vagueBudget) {
      score -= 25
      findings.push({
        title: "Vague budget terms",
        description: "Budget uses non-specific terms that could lead to payment disputes.",
        evidence: data.budget,
      })
    }
  }

  const paymentPatterns = [
    /net 30|net 60|net 90|pay after|payment upon/i,
    /deferred|delayed payment|pay when/i,
    /budget constraint|tight budget|limited budget/i,
    /equity|revenue share|commission based/i,
  ]

  const matched = matchSignals(data.clientSignals, paymentPatterns)
  if (matched.length > 0) {
    score -= matched.length * 15
    findings.push({
      title: "Payment risk signals",
      description: "Client language suggests payment structure concerns.",
      evidence: matched.join("; "),
    })
  }

  const paymentMissingInfo = data.missingInformation.filter(
    (m) => /payment|budget|rate|fee|cost|pricing/i.test(m)
  )
  if (paymentMissingInfo.length > 0) {
    score -= paymentMissingInfo.length * 10
    findings.push({
      title: "Payment information gaps",
      description: "Key financial details are missing from the project description.",
      evidence: paymentMissingInfo.join("; "),
    })
  }

  return {
    score: clampScore(score),
    severity: severityFromScore(score),
    findings,
    mitigations: findings.length > 0
      ? "Define a clear payment schedule with milestones. Use escrow or deposits for large projects. Include late payment terms in your agreement."
      : "Maintain your current payment structure with clear milestones and terms.",
  }
}

function evaluateTimelineRisk(data: ExtractedData): RiskCategory {
  const findings: RiskFinding[] = []
  let score = 100

  if (!data.timeline) {
    score -= 30
    findings.push({
      title: "No timeline defined",
      description: "The project has no mentioned timeline or deadline.",
      evidence: "Timeline field is empty",
    })
  }

  const urgencyPatterns = [
    /ASAP|urgent|yesterday|rush|immediately/i,
    /quick turnaround|tight deadline|as soon as possible/i,
    /needed by|must be done by|critical deadline/i,
    /yesterday|overdue|late|behind/i,
  ]

  const matched = matchSignals(data.clientSignals, urgencyPatterns)
  if (matched.length > 0) {
    score -= matched.length * 15
    findings.push({
      title: matched.length > 1 ? "Multiple urgency signals" : "Urgency signal detected",
      description: "Client language indicates time pressure which may lead to unrealistic expectations.",
      evidence: matched.join("; "),
    })
  }

  const timelineMissingInfo = data.missingInformation.filter(
    (m) => /timeline|deadline|milestone|schedule|completion date/i.test(m)
  )
  if (timelineMissingInfo.length > 0) {
    score -= timelineMissingInfo.length * 12
    findings.push({
      title: "Timeline information gaps",
      description: "Schedule-related information is missing.",
      evidence: timelineMissingInfo.join("; "),
    })
  }

  return {
    score: clampScore(score),
    severity: severityFromScore(score),
    findings,
    mitigations: findings.length > 0
      ? "Define clear milestones with specific dates. Include buffer time for revisions and feedback. Add a rush fee clause for accelerated timelines."
      : "Continue documenting timeline expectations clearly.",
  }
}

function evaluateCommunicationRisk(data: ExtractedData): RiskCategory {
  const findings: RiskFinding[] = []
  let score = 100

  const ambiguityPatterns = [
    /change|changes|evolve|iterative|feedback/i,
    /might change|not sure|uncertain|undecided/i,
    /flexible|open ended|see how it goes/i,
    /multiple stakeholders|many opinions|committee/i,
  ]

  const matched = matchSignals(data.clientSignals, ambiguityPatterns)
  if (matched.length > 0) {
    score -= matched.length * 12
    findings.push({
      title: "Communication risk signals",
      description: "Client language suggests potential for changing requirements or unclear communication.",
      evidence: matched.join("; "),
    })
  }

  if (data.goals.length === 0) {
    score -= 20
    findings.push({
      title: "No project goals defined",
      description: "Without clear goals, requirements are inherently ambiguous.",
      evidence: "Goals field is empty",
    })
  } else if (data.goals.length === 1) {
    score -= 5
  }

  if (data.missingInformation.length > 3) {
    score -= 15
    findings.push({
      title: "Significant information gaps",
      description: "Multiple missing information items indicate communication gaps.",
      evidence: `${data.missingInformation.length} items missing`,
    })
  }

  return {
    score: clampScore(score),
    severity: severityFromScore(score),
    findings,
    mitigations: findings.length > 0
      ? "Establish a single point of contact. Define a feedback process with clear turnaround times. Document all requirements in writing before starting."
      : "Keep documenting requirements clearly and maintaining regular communication.",
  }
}

function evaluateRevisionRisk(data: ExtractedData): RiskCategory {
  const findings: RiskFinding[] = []
  let score = 100

  const revisionPatterns = [
    /unlimited revisions|unlimited changes/i,
    /until satisfied|until happy|until perfect/i,
    /revisions? included|iterations? included/i,
    /ongoing support|continuous improvement|retainer/i,
    /keep working until|however many changes/i,
  ]

  const matched = matchSignals(data.clientSignals, revisionPatterns)
  if (matched.length > 0) {
    score -= matched.length * 20
    findings.push({
      title: matched.length > 1 ? "Multiple revision risk signals" : "Revision risk signal detected",
      description: "Client language suggests open-ended revision expectations.",
      evidence: matched.join("; "),
    })
  }

  const supportPatterns = [/support|maintenance|ongoing|continuous/i]
  const supportMatched = matchSignals(data.clientSignals, supportPatterns)
  if (supportMatched.length > 0) {
    score -= 15
    findings.push({
      title: "Ongoing support expectations",
      description: "Client may expect post-delivery support beyond the project scope.",
      evidence: supportMatched.join("; "),
    })
  }

  if (data.deliverables.length <= 2 && data.deliverables.length > 0) {
    score -= 10
    findings.push({
      title: "Vague deliverable count",
      description: "Few deliverables combined with revision language increases risk.",
      evidence: `${data.deliverables.length} deliverables specified`,
    })
  }

  return {
    score: clampScore(score),
    severity: severityFromScore(score),
    findings,
    mitigations: findings.length > 0
      ? "Specify a fixed number of revision rounds in your agreement. Define what constitutes a revision vs. new work. Charge for additional revisions."
      : "Consider specifying revision limits in your agreement even if not discussed.",
  }
}

function evaluateLegalRisk(data: ExtractedData): RiskCategory {
  const findings: RiskFinding[] = []
  let score = 100

  const legalPatterns = [
    /contract|agreement|terms|legal/i,
    /liability|indemnify|hold harmless/i,
    /lawsuit|dispute|attorney|legal action/i,
    /waiver|release|arbitration/i,
  ]

  const matched = matchSignals(data.clientSignals, legalPatterns)
  if (matched.length > 0) {
    score -= matched.length * 15
    findings.push({
      title: "Legal signals detected",
      description: "Client has mentioned legal terms or conditions that may need review.",
      evidence: matched.join("; "),
    })
  }

  const legalMissingInfo = data.missingInformation.filter(
    (m) => /contract|legal|terms|agreement|liability/i.test(m)
  )
  if (legalMissingInfo.length > 0) {
    score -= legalMissingInfo.length * 15
    findings.push({
      title: "Legal information gaps",
      description: "Legal framework for the project is unclear.",
      evidence: legalMissingInfo.join("; "),
    })
  }

  if (!data.projectType) {
    score -= 10
  }

  return {
    score: clampScore(score),
    severity: severityFromScore(score),
    findings,
    mitigations: findings.length > 0
      ? "Use a professional services agreement with clear liability terms. Consider including a limitation of liability clause. Consult a lawyer for high-value projects."
      : "Continue using your standard agreement with proper legal protections.",
  }
}

function evaluateIpRisk(data: ExtractedData): RiskCategory {
  const findings: RiskFinding[] = []
  let score = 100

  const ipPatterns = [
    /rights|ownership|intellectual property/i,
    /license|exclusive|transfer|assign/i,
    /copyright|trademark|patent/i,
    /who owns|my property|full rights/i,
  ]

  const matched = matchSignals(data.clientSignals, ipPatterns)
  if (matched.length > 0) {
    score -= matched.length * 20
    findings.push({
      title: matched.length > 1 ? "Multiple IP references" : "IP ownership referenced",
      description: "Client has mentioned intellectual property or ownership rights.",
      evidence: matched.join("; "),
    })
  }

  const ipMissingInfo = data.missingInformation.filter(
    (m) => /rights|ownership|ip|intellectual property|license/i.test(m)
  )
  if (ipMissingInfo.length > 0) {
    score -= ipMissingInfo.length * 15
    findings.push({
      title: "IP ownership information missing",
      description: "Ownership of project deliverables has not been clarified.",
      evidence: ipMissingInfo.join("; "),
    })
  }

  if (data.projectType && /design|brand|logo|content|writing|creative/i.test(data.projectType)) {
    score -= 10
    findings.push({
      title: "Creative work IP considerations",
      description: "Creative projects often require clear IP transfer terms.",
      evidence: `Project type: ${data.projectType}`,
    })
  }

  return {
    score: clampScore(score),
    severity: severityFromScore(score),
    findings,
    mitigations: findings.length > 0
      ? "Specify IP transfer terms in your agreement. Clarify what is being transferred (final deliverables vs. concepts/tools). Consider a license model instead of full transfer."
      : "Include standard IP clauses in your agreement clarifying ownership of deliverables.",
  }
}

function evaluateClientBehaviorRisk(data: ExtractedData): RiskCategory {
  const findings: RiskFinding[] = []
  let score = 100

  const redFlagPatterns = [
    /urgent|ASAP|yesterday|rush|immediately/i,
    /unlimited|whatever it takes|whatever needed/i,
    /small project|quick job|easy work|simple task/i,
    /exposure|equity|deferred payment|pay later/i,
    /just need|only need|basically done|minor changes/i,
    /multiple stakeholders|approval needed|committee/i,
  ]

  const matched = matchSignals(data.clientSignals, redFlagPatterns)
  if (matched.length > 0) {
    score -= matched.length * 12
    if (matched.length >= 3) {
      findings.push({
        title: "Multiple red flags detected",
        description: "Several behavioral risk indicators were identified in client communication.",
        evidence: matched.join("; "),
      })
    } else {
      findings.push({
        title: "Behavioral risk signal",
        description: "Client communication contains potential red flag language.",
        evidence: matched.join("; "),
      })
    }
  }

  if (data.missingInformation.length > 5) {
    score -= 15
    findings.push({
      title: "Significant information gaps",
      description: "A high number of missing information items may indicate vague or unrealistic expectations.",
      evidence: `${data.missingInformation.length} items missing`,
    })
  } else if (data.missingInformation.length > 3) {
    score -= 8
    findings.push({
      title: "Several information gaps",
      description: "Missing information suggests incomplete project definition.",
      evidence: `${data.missingInformation.length} items missing`,
    })
  }

  if (!data.projectType && !data.timeline && !data.budget) {
    score -= 15
    findings.push({
      title: "Minimal project definition",
      description: "Lack of basic project details suggests high-level or vague expectations.",
      evidence: "Project type, timeline, and budget are all unspecified",
    })
  }

  return {
    score: clampScore(score),
    severity: severityFromScore(score),
    findings,
    mitigations: findings.length > 0
      ? "Gather more information before committing. Use a detailed discovery phase. Set clear boundaries and expectations in writing. Trust your instincts if something feels off."
      : "Continue your current vetting process. Stay alert to changes in communication patterns.",
  }
}

function generateSummary(categories: RiskReport["categories"], overallScore: number): string {
  const highRiskCategories = Object.entries(categories)
    .filter(([, c]) => c.severity === "high")
    .map(([key]) => key.replace(/([A-Z])/g, " $1").trim().toLowerCase())

  const mediumRiskCategories = Object.entries(categories)
    .filter(([, c]) => c.severity === "medium")
    .map(([key]) => key.replace(/([A-Z])/g, " $1").trim().toLowerCase())

  if (highRiskCategories.length > 0) {
    return `High risk detected in ${highRiskCategories.join(", ")}. ${mediumRiskCategories.length > 0 ? `Medium risk in ${mediumRiskCategories.join(", ")}. ` : ""}Consider addressing these areas before proceeding with the project. Overall score: ${overallScore}/100.`
  }

  if (mediumRiskCategories.length > 0) {
    return `Medium risk detected in ${mediumRiskCategories.join(", ")}. These areas need attention but don't present immediate deal-breaking concerns. Overall score: ${overallScore}/100.`
  }

  return `Overall risk level is low across all categories. The project appears well-defined with minimal risk indicators. Overall score: ${overallScore}/100.`
}

export function generateRiskReport(data: ExtractedData): RiskReport {
  const categories = {
    scopeRisk: evaluateScopeRisk(data),
    paymentRisk: evaluatePaymentRisk(data),
    timelineRisk: evaluateTimelineRisk(data),
    communicationRisk: evaluateCommunicationRisk(data),
    revisionRisk: evaluateRevisionRisk(data),
    legalRisk: evaluateLegalRisk(data),
    ipRisk: evaluateIpRisk(data),
    clientBehaviorRisk: evaluateClientBehaviorRisk(data),
  }

  const scores = Object.values(categories).map((c) => c.score)
  const overallScore = clampScore(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length))

  let riskLevel: "Low" | "Medium" | "High"
  if (overallScore >= 80) riskLevel = "Low"
  else if (overallScore >= 50) riskLevel = "Medium"
  else riskLevel = "High"

  const summary = generateSummary(categories, overallScore)

  return { overallScore, riskLevel, categories, summary, recommendations: [] }
}
