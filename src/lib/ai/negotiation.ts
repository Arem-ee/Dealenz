import { callAISurface, type AISurface } from "./client"
import { applyConstitution } from "./constitution"
import { maxTokensForOperation } from "./operations"
import { GENERIC_NEGOTIATION_POINTS_SYSTEM_PROMPT } from "./prompts"
import type { ExtractedData } from "./extract"
import type { GenericRiskReport } from "./risk-analysis"
import type { Finding } from "@/lib/rules/result"

export async function generateNegotiationPoints(
  data: ExtractedData,
  report: GenericRiskReport,
  surface: AISurface = "authenticated",
  // Deterministic findings for the model to reason over. Additive context:
  // the model explains and prioritizes them but never re-decides their
  // status (see detectFindingConflicts in src/lib/rules/result.ts).
  findings: Finding[] = []
): Promise<string[]> {
  const input = JSON.stringify({ extractedData: data, riskFindings: report.categories, summary: report.summary, recommendations: report.recommendations, deterministicFindings: findings.map((f) => ({ ruleKey: f.ruleKey, status: "FAIL", summary: f.summary, severity: f.severity })) }, null, 2)
  // Talking points are user-facing prose, so the response contract applies.
  const systemPrompt = applyConstitution(GENERIC_NEGOTIATION_POINTS_SYSTEM_PROMPT, "negotiation")
  const { text: raw } = await callAISurface(surface, { systemPrompt, userContent: input, temperature: 0.4, maxTokens: maxTokensForOperation("negotiation") })
  let cleaned = raw.trim()
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenceMatch) cleaned = fenceMatch[1].trim()
  const parsed = JSON.parse(cleaned) as { points: unknown }
  if (!Array.isArray(parsed.points)) return []
  return parsed.points.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, 10)
}
