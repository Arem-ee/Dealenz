import { callAI } from "./client"
import { GENERIC_NEGOTIATION_POINTS_SYSTEM_PROMPT } from "./prompts"
import type { ExtractedData } from "./extract"
import type { GenericRiskReport } from "./risk-analysis"

export async function generateNegotiationPoints(data: ExtractedData, report: GenericRiskReport): Promise<string[]> {
  const input = JSON.stringify({ extractedData: data, riskFindings: report.categories, summary: report.summary, recommendations: report.recommendations }, null, 2)
  const raw = await callAI({ systemPrompt: GENERIC_NEGOTIATION_POINTS_SYSTEM_PROMPT, userContent: input, temperature: 0.4, maxTokens: 1000 })
  let cleaned = raw.trim()
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenceMatch) cleaned = fenceMatch[1].trim()
  const parsed = JSON.parse(cleaned) as { points: unknown }
  if (!Array.isArray(parsed.points)) return []
  return parsed.points.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, 10)
}
