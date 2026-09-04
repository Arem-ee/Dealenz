import { callAISurface, type AISurface } from "./client"
import type { ExtractedData } from "./extract"
import type { RiskReport, RiskCategory, RiskFinding } from "@/lib/risk/engine"
import { generateRiskReport } from "@/lib/risk/engine"
import { RISK_ANALYSIS_SYSTEM_PROMPT, GENERIC_RISK_ANALYSIS_SYSTEM_PROMPT } from "./prompts"

interface GeminiFinding {
  title: string
  description: string
  severity: string
  suggestion: string
}

interface GeminiCategory {
  score: number
  findings: GeminiFinding[]
}

interface GeminiRiskOutput {
  summary: string
  overallScore: number
  riskLevel: string
  recommendations: string[]
  categories: Record<string, GeminiCategory>
}

function severityFromScore(score: number): "low" | "medium" | "high" {
  if (score >= 80) return "low"
  if (score >= 50) return "medium"
  return "high"
}

function mapRiskLevel(level: string): "Low" | "Medium" | "High" {
  const l = level.toLowerCase()
  if (l === "critical" || l === "high") return "High"
  if (l === "medium") return "Medium"
  return "Low"
}

function buildFindings(findings: GeminiFinding[]): RiskFinding[] {
  return findings.map((f) => ({
    title: f.title,
    description: f.description,
    evidence: f.suggestion || "",
  }))
}

function buildMitigations(findings: GeminiFinding[]): string {
  const suggestions = findings.map((f) => f.suggestion).filter(Boolean)
  return suggestions.length > 0 ? suggestions.join(" ") : ""
}

function transformGeminiOutput(parsed: GeminiRiskOutput): RiskReport {
  const cats = parsed.categories || {}

  function cat(key: string): RiskCategory {
    const c = cats[key]
    if (!c) return { score: 85, severity: "low", findings: [], mitigations: "" }
    return {
      score: Math.max(0, Math.min(100, Math.round(c.score))),
      severity: severityFromScore(c.score),
      findings: buildFindings(c.findings || []),
      mitigations: buildMitigations(c.findings || []),
    }
  }

  const scopeCategory = cat("scope")
  const paymentCategory = cat("payment")
  const timelineCategory = cat("timeline")
  const communicationCategory = cat("communication")
  const revisionCategory = cat("revisionRisk")
  const legalCategory = mergeCategories(cat("legal"), cat("contract"))
  const ipCategory = cat("ip")
  const clientBehaviorCategory = cat("clientSignals")

  const categories = {
    scopeRisk: scopeCategory,
    paymentRisk: paymentCategory,
    timelineRisk: timelineCategory,
    communicationRisk: communicationCategory,
    revisionRisk: revisionCategory,
    legalRisk: legalCategory,
    ipRisk: ipCategory,
    clientBehaviorRisk: clientBehaviorCategory,
  }

  const scores = Object.values(categories).map((c) => c.score)
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

  const overallScore = typeof parsed.overallScore === "number"
    ? Math.max(0, Math.min(100, Math.round(parsed.overallScore)))
    : avgScore

  const riskLevel = mapRiskLevel(parsed.riskLevel || "medium")
  const summary = parsed.summary || generateRiskReport({ goals: [], deliverables: [], timeline: null, budget: null, projectType: null, clientSignals: [], missingInformation: [], confidence: 0 }).summary
  const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : []

  return { overallScore, riskLevel, categories, summary, recommendations }
}

function mergeCategories(a: RiskCategory, b: RiskCategory): RiskCategory {
  return {
    score: Math.round((a.score + b.score) / 2),
    severity: a.score <= b.score ? a.severity : b.severity,
    findings: [...a.findings, ...b.findings],
    mitigations: [a.mitigations, b.mitigations].filter(Boolean).join(" "),
  }
}

function parseRiskResponse(text: string): GeminiRiskOutput {
  try {
    let cleaned = text.trim()
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim()
    }
    return JSON.parse(cleaned)
  } catch (error) {
    console.error("parseRiskResponse: JSON parse failed:", error)
    throw new Error("AI returned malformed JSON structure")
  }
}

export async function analyzeRisk(
  data: ExtractedData,
  surface: AISurface = "authenticated"
): Promise<{ report: RiskReport; usedFallback: boolean }> {
  try {
    const input = JSON.stringify(data, null, 2)
    const { text: raw, meta } = await callAISurface(surface, { systemPrompt: RISK_ANALYSIS_SYSTEM_PROMPT, userContent: input })
    const parsed = parseRiskResponse(raw)
    return { report: transformGeminiOutput(parsed), usedFallback: meta.servedByFallback ?? false }
  } catch (err) {
    console.error("Gemini risk analysis failed, falling back to rule engine:", err instanceof Error ? err.message : err)
    return { report: generateRiskReport(data), usedFallback: true }
  }
}

export interface GenericRiskCategory {
  score: number
  severity: "low" | "medium" | "high"
  findings: RiskFinding[]
  mitigations: string
}

export interface GenericRiskReport {
  overallScore: number
  riskLevel: "Low" | "Medium" | "High"
  categories: Record<string, GenericRiskCategory>
  summary: string
  recommendations: string[]
}

function severityFromScoreGeneric(score: number): "low" | "medium" | "high" {
  if (score >= 80) return "low"
  if (score >= 50) return "medium"
  return "high"
}

function transformGenericOutput(parsed: GeminiRiskOutput): GenericRiskReport {
  const rawCats = parsed.categories || {}
  const categories: Record<string, GenericRiskCategory> = {}
  for (const [key, value] of Object.entries(rawCats)) {
    const score = Math.max(0, Math.min(100, Math.round(value.score)))
    categories[key] = {
      score,
      severity: severityFromScoreGeneric(score),
      findings: buildFindings(value.findings || []),
      mitigations: buildMitigations(value.findings || []),
    }
  }
  const scores = Object.values(categories).map((c) => c.score)
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 85
  const overallScore = typeof parsed.overallScore === "number" ? Math.max(0, Math.min(100, Math.round(parsed.overallScore))) : avgScore
  const riskLevel = mapRiskLevel(parsed.riskLevel || "medium")
  const summary = parsed.summary || `Generic agreement review. Overall score ${overallScore}/100.`
  const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : []
  return { overallScore, riskLevel, categories, summary, recommendations }
}

function parseGenericResponse(text: string): GeminiRiskOutput {
  try {
    let cleaned = text.trim()
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (fenceMatch) cleaned = fenceMatch[1].trim()
    return JSON.parse(cleaned)
  } catch (error) {
    console.error("parseGenericResponse: JSON parse failed:", error)
    throw new Error("AI returned malformed JSON structure")
  }
}

export async function analyzeGenericRiskWithVisibleFailure(
  data: ExtractedData,
  surface: AISurface = "authenticated"
): Promise<{ report: GenericRiskReport; usedFallback: false }> {
  const input = JSON.stringify(data, null, 2)
  const { text: raw } = await callAISurface(surface, { systemPrompt: GENERIC_RISK_ANALYSIS_SYSTEM_PROMPT, userContent: input })
  const parsed = parseGenericResponse(raw)
  return { report: transformGenericOutput(parsed), usedFallback: false }
}

export type DealType = "freelance" | "generic"

export async function analyzeRiskForDealType(
  data: ExtractedData,
  dealType: DealType,
  surface: AISurface = "authenticated"
): Promise<{ report: RiskReport | GenericRiskReport; usedFallback: boolean; genericAnalysisUnavailable: boolean }> {
  if (dealType === "generic") {
    try {
      const result = await analyzeGenericRiskWithVisibleFailure(data, surface)
      return { report: result.report, usedFallback: false, genericAnalysisUnavailable: false }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      throw new Error(`Automated risk analysis is unavailable right now. Please try again or review the agreement manually. Details: ${message}`)
    }
  }
  const result = await analyzeRisk(data, surface)
  return { report: result.report, usedFallback: result.usedFallback, genericAnalysisUnavailable: false }
}
