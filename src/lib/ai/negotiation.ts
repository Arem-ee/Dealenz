import { callAISurface, type AISurface } from "./client"
import { applyConstitution } from "./constitution"
import { maxTokensForOperation } from "./operations"
import type { TokenUsage, UsageReporter } from "./usage"
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
  findings: Finding[] = [],
  onUsage?: UsageReporter,
  // Response language (i18n D4): prose only, findings stay English.
  language?: string
): Promise<string[]> {
  const input = JSON.stringify({ extractedData: data, riskFindings: report.categories, summary: report.summary, recommendations: report.recommendations, deterministicFindings: findings.map((f) => ({ ruleKey: f.ruleKey, status: "FAIL", summary: f.summary, severity: f.severity })) }, null, 2)
  // Talking points are user-facing prose, so the response contract applies.
  const { responseLanguageInstruction } = await import("./language")
  const systemPrompt =
    applyConstitution(GENERIC_NEGOTIATION_POINTS_SYSTEM_PROMPT, "negotiation") +
    responseLanguageInstruction(language)
  const { text: raw, meta } = await callAISurface(surface, { systemPrompt, userContent: input, temperature: 0.4, maxTokens: maxTokensForOperation("negotiation") })
  onUsage?.({
    provider: meta.primary.provider,
    model: meta.primary.model,
    usage: meta.usage,
    status: "success",
  })
  let cleaned = raw.trim()
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenceMatch) cleaned = fenceMatch[1].trim()
  const parsed = JSON.parse(cleaned) as { points: unknown }
  if (!Array.isArray(parsed.points)) return []
  return parsed.points.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, 10)
}

/**
 * Drafts counter-language for ONE fallback rung (round evaluation only).
 * The rung is chosen deterministically by evaluateClauseRound; the model
 * only restates it against the counterparty's wording — verdicts never
 * come from AI. Returns drafted text plus measured usage for settlement.
 */
export async function draftCounterLanguage(
  input: {
    clauseTitle: string
    counterpartyText: string
    rungBody: string
    rung: number
    condition: string
    /** Response language (i18n D4): prose only, obligations untouched. */
    language?: string
  },
  surface: AISurface = "authenticated",
  onUsage?: UsageReporter
): Promise<{ text: string; usage?: TokenUsage }> {
  const { responseLanguageInstruction } = await import("./language")
  const systemPrompt =
    applyConstitution(
      `You restate approved fallback contract language against counterparty wording. Rules: output ONLY the revised clause text, no preamble, no explanation. Hold the fallback's legal meaning exactly — change wording, never obligations, caps, time periods, or parties. Stay within the rung; do not invent new concessions. If the counterparty text already matches the fallback, return the fallback verbatim.`,
      "negotiation"
    ) + responseLanguageInstruction(input.language)
  const userContent = JSON.stringify({
    clause: input.clauseTitle,
    fallbackRung: input.rung,
    approvedFallback: input.rungBody,
    offeredWhen: input.condition || "(standing fallback)",
    counterpartyWording: input.counterpartyText.slice(0, 4000),
  })
  const { text: raw, meta } = await callAISurface(surface, {
    systemPrompt,
    userContent,
    temperature: 0.3,
    maxTokens: 1024,
  })
  onUsage?.({
    provider: meta.primary.provider,
    model: meta.primary.model,
    usage: meta.usage,
    status: "success",
  })
  let cleaned = raw.trim()
  const fenceMatch = cleaned.match(/```(?:[a-z]*)\s*([\s\S]*?)\s*```/i)
  if (fenceMatch) cleaned = fenceMatch[1].trim()
  return { text: cleaned.slice(0, 8000), usage: meta.usage }
}
