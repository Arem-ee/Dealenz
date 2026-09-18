import { callAISurface, type AISurface } from "./client"
import { EXTRACTION_SYSTEM_PROMPT, GENERIC_EXTRACTION_SYSTEM_PROMPT } from "./prompts"

export interface ExtractedData {
  goals: string[]
  deliverables: string[]
  timeline: string | null
  budget: string | null
  // Structured preservation of materially conflicting observations.
  // When multiple distinct values are observed (e.g. "net 15; net 30"), the
  // raw string is kept in budget/timeline for backward compat, and the split
  // terms are in budgetTerms/timelineTerms with per-term evidence.
  // Optional for backward compat: legacy audits/fixtures may lack them;
  // consumers must use (extracted.budgetTerms ?? []) and never assume presence.
  budgetTerms?: string[]
  timelineTerms?: string[]
  projectType: string | null
  clientSignals: string[]
  missingInformation: string[]
  confidence: number
}

function extractJson(text: string): string {
  const trimmed = text.trim()

  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim()

  if (stripped.startsWith("{")) return stripped

  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")

  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1)
  }

  throw new Error("No JSON object found in model response")
}

function stringArray(value: unknown): string[] {
  // Model output is untrusted: non-string items are dropped rather than
  // coerced (String({}) would inject "[object Object]" into facts, and raw
  // items crash downstream .trim() calls).
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function splitTerms(value: string | null): string[] {
  if (!value) return []
  if (value.includes(";")) {
    return value.split(";").map((s) => s.trim()).filter((s) => s.length > 0)
  }
  // Fallback for " and "/" or " and ", later changed to" when no ";" but two distinct terms exist
  const hasTwoPayments = (value.match(/net\s*\d+/gi) ?? []).length >= 2 || (value.match(/\$\s*[\d,]+/g) ?? []).length >= 2
  const hasTwoDates = (value.match(/\d{4}-\d{2}-\d{2}/g) ?? []).length >= 2 || (value.match(/\d+\s*days?/gi) ?? []).length >= 2
  const hasTwoTerms = hasTwoPayments || hasTwoDates
  if (hasTwoTerms) {
    // Split on " and " / " or " first
    if (/\s+and\s+|\s+or\s+/i.test(value)) {
      const parts = value.split(/\s+(?:and|or)\s+/i).map((s) => s.trim()).filter((s) => s.length > 0)
      if (parts.length >= 2) return parts
    }
    // Handle "30 days, later changed to 45 days" and similar comma cases
    if (value.includes(",")) {
      let parts = value.split(/\s*,\s*/).map((s) => s.trim()).filter((s) => s.length > 0)
      parts = parts.map((p) => p.replace(/^(later changed to\s*)/i, "").trim()).filter((s) => s.length > 0)
      // Further split any part that still contains " and " / " or "
      const expanded: string[] = []
      for (const p of parts) {
        if (/\s+and\s+|\s+or\s+/i.test(p)) {
          expanded.push(...p.split(/\s+(?:and|or)\s+/i).map((s) => s.trim()).filter((s) => s.length > 0))
        } else {
          expanded.push(p)
        }
      }
      if (expanded.length >= 2) return expanded
    }
  }
  return [value.trim()]
}

function parseExtractedResponse(text: string): ExtractedData {
  const cleaned = extractJson(text)
  const parsed = JSON.parse(cleaned)

  const budget = typeof parsed.budget === "string" ? parsed.budget : null
  const timeline = typeof parsed.timeline === "string" ? parsed.timeline : null

  return {
    goals: stringArray(parsed.goals),
    deliverables: stringArray(parsed.deliverables),
    timeline,
    budget,
    budgetTerms: splitTerms(budget),
    timelineTerms: splitTerms(timeline),
    projectType: typeof parsed.projectType === "string" ? parsed.projectType : null,
    clientSignals: stringArray(parsed.clientSignals),
    missingInformation: stringArray(parsed.missingInformation),
    confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0,
  }
}

export type DealType = "freelance" | "generic" | "lease" | "purchase_sale" | "employment" | "founder" | "partnership"

export interface ExtractionValidationResult {
  valid: boolean
  reason?: string
  extractedData?: ExtractedData
}

function validateExtraction(data: ExtractedData): ExtractionValidationResult {
  const populatedFields = [
    data.goals.length > 0,
    data.deliverables.length > 0,
    data.timeline !== null,
    data.budget !== null,
    data.projectType !== null,
    data.clientSignals.length > 0,
  ].filter(Boolean).length

  const hasMeaningfulContent = data.goals.some(g => g.trim().length > 2) ||
    data.deliverables.some(d => d.trim().length > 2) ||
    data.clientSignals.some(s => s.trim().length > 2) ||
    (data.timeline !== null && data.timeline.trim().length > 2) ||
    (data.budget !== null && data.budget.trim().length > 2) ||
    (data.projectType !== null && data.projectType.trim().length > 2)

  const confidenceOk = data.confidence >= 0.5
  const enoughFields = populatedFields >= 2
  const meaningfulContent = hasMeaningfulContent

  if (!confidenceOk) {
    return { valid: false, reason: "low_confidence" }
  }
  if (!enoughFields) {
    return { valid: false, reason: "insufficient_fields" }
  }
  if (!meaningfulContent) {
    return { valid: false, reason: "no_meaningful_content" }
  }

  return { valid: true, extractedData: data }
}

export async function extractProjectData(
  input: string,
  dealType: DealType = "freelance",
  surface: AISurface = "authenticated"
): Promise<ExtractedData> {
  if (!input.trim()) {
    throw new Error("No input provided for extraction")
  }

  // Lease deals use the agreement-oriented generic prompt until a
  // lease-specific extraction schema exists (future vertical work).
  const prompt = dealType === "freelance" ? EXTRACTION_SYSTEM_PROMPT : GENERIC_EXTRACTION_SYSTEM_PROMPT

  try {
    const { text } = await callAISurface(surface, { systemPrompt: prompt, userContent: input, temperature: 0.2 })
    return parseExtractedResponse(text)
  } catch {
    throw new Error("Failed to parse AI extraction result")
  }
}

export async function extractAndValidate(
  input: string,
  dealType: DealType = "freelance",
  surface: AISurface = "authenticated"
): Promise<ExtractionValidationResult> {
  const extracted = await extractProjectData(input, dealType, surface)
  return validateExtraction(extracted)
}
