import { callAI } from "./client"
import { EXTRACTION_SYSTEM_PROMPT, GENERIC_EXTRACTION_SYSTEM_PROMPT } from "./prompts"

export interface ExtractedData {
  goals: string[]
  deliverables: string[]
  timeline: string | null
  budget: string | null
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

  throw new Error("No JSON object found in Gemini response")
}

function parseExtractedResponse(text: string): ExtractedData {
  const cleaned = extractJson(text)
  const parsed = JSON.parse(cleaned)

  return {
    goals: Array.isArray(parsed.goals) ? parsed.goals : [],
    deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables : [],
    timeline: typeof parsed.timeline === "string" ? parsed.timeline : null,
    budget: typeof parsed.budget === "string" ? parsed.budget : null,
    projectType: typeof parsed.projectType === "string" ? parsed.projectType : null,
    clientSignals: Array.isArray(parsed.clientSignals) ? parsed.clientSignals : [],
    missingInformation: Array.isArray(parsed.missingInformation) ? parsed.missingInformation : [],
    confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0,
  }
}

export type DealType = "freelance" | "generic"

export async function extractProjectData(input: string, dealType: DealType = "freelance"): Promise<ExtractedData> {
  if (!input.trim()) {
    throw new Error("No input provided for extraction")
  }

  const prompt = dealType === "generic" ? GENERIC_EXTRACTION_SYSTEM_PROMPT : EXTRACTION_SYSTEM_PROMPT

  try {
    const text = await callAI({ systemPrompt: prompt, userContent: input, temperature: 0.2 })
    return parseExtractedResponse(text)
  } catch {
    throw new Error("Failed to parse AI extraction result")
  }
}
