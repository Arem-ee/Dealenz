// Context inference (Phase 5B).
//
// AI proposes context; it never decides it. The model returns observable
// facts only (places named, roles stated, money terms, industry cues). The
// prompt explicitly forbids legal conclusions, and every model output is
// validated through the context schema before it can be persisted. Malformed
// output fails safely with an error — never as valid-looking context.
// Inference never overwrites user-confirmed fields (see mergeInferredContext).

import { callAISurface, type AISurface } from "@/lib/ai/client"
import {
  emptyContextEnvelope,
  parseContextEnvelope,
  type ContextEnvelope,
  type ContextField,
  type ContextFieldKey,
  type DealType,
} from "./schema"

const CONTEXT_INFERENCE_SYSTEM_PROMPT = `You are a context spotter for deal intake. From the provided deal text and extracted facts, report only directly observable context facts.

Return a JSON object with exactly this shape (omit nothing, add nothing):
{
  "jurisdiction": { "value": "place name as written, or null", "confidence": 0-1 },
  "governingLaw": { "value": "governing-law clause as written, or null", "confidence": 0-1 },
  "userRole": { "value": "one of freelancer, client, employer, employee, contractor, landlord, tenant, buyer, seller, partner, cofounder, investor, founder, service_provider, customer, other, or null", "confidence": 0-1 },
  "counterpartyRole": { "value": "same vocabulary or null", "confidence": 0-1 },
  "industry": { "value": "one of technology, creative, construction, healthcare, finance, education, retail, hospitality, manufacturing, legal, consulting, real_estate, other, or null", "confidence": 0-1 },
  "transactionStructure": { "value": "one of fixed_price, hourly, retainer, milestone_based, equity, lease, sale, partnership, employment, other, or null", "confidence": 0-1 },
  "transactionValue": { "value": "number or null", "confidence": 0-1 },
  "transactionCurrency": { "value": "3-letter code like USD, or null", "confidence": 0-1 },
  "transactionStage": { "value": "one of inquiry, negotiation, draft, review, signed, active, renewal, dispute, other, or null", "confidence": 0-1 },
  "crossBorder": { "value": "true, false, or null", "confidence": 0-1 },
  "regulatedIndustry": { "value": "true, false, or null", "confidence": 0-1 },
  "entityTypes": { "value": "array subset of individual, company, partnership, nonprofit, government, other, or null", "confidence": 0-1 }
}

Rules:
- Report only what the text states or plainly implies. Use null with confidence 0 when the text says nothing.
- Confidence is your uncertainty about the observation, not legal certainty.
- NEVER decide whether the agreement is valid, enforceable, compliant, lawful, or which law definitively applies. If the text names a place or a clause, quote the observation only.
- Return ONLY valid JSON. No markdown.`

export interface InferenceInput {
  dealType: DealType
  rawInput?: string
  extractedSummary?: string
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
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1)
  throw new Error("No JSON object found in context inference response")
}

type InferredFieldKey = Exclude<ContextFieldKey, "dealType">

function toContextField(key: InferredFieldKey, raw: unknown): ContextField<never> {
  if (raw === null || raw === undefined) {
    return { value: null, source: "unknown", confidence: 0 }
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Inferred context field "${key}" is malformed`)
  }
  const { value, confidence } = raw as { value?: unknown; confidence?: unknown }
  if (value === null || value === undefined) {
    return { value: null, source: "unknown", confidence: 0 }
  }
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`Inferred context field "${key}" has an invalid confidence`)
  }
  if (confidence <= 0) {
    return { value: null, source: "unknown", confidence: 0 }
  }
  // Value shape is verified by parseContextEnvelope below; source is always inferred here.
  return { value: value as never, source: "inferred", confidence }
}

// Runs model inference and returns a validated partial envelope (deal type and
// bookkeeping filled by the caller). Throws on malformed output.
export async function inferContextFields(
  input: InferenceInput,
  surface: AISurface = "authenticated"
): Promise<ContextEnvelope> {
  const parts: string[] = [`Deal type selected by user: ${input.dealType}.`]
  if (input.extractedSummary?.trim()) parts.push(`Extracted facts: ${input.extractedSummary.trim()}`)
  if (input.rawInput?.trim()) parts.push(`Deal text: ${input.rawInput.trim().slice(0, 8000)}`)
  if (parts.length === 1) throw new Error("No input provided for context inference")

  const { text } = await callAISurface(surface, {
    systemPrompt: CONTEXT_INFERENCE_SYSTEM_PROMPT,
    userContent: parts.join("\n\n"),
    temperature: 0.1,
  })

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(extractJson(text)) as Record<string, unknown>
  } catch {
    throw new Error("Failed to parse AI context inference result")
  }

  const envelope = emptyContextEnvelope()
  const keys: InferredFieldKey[] = [
    "jurisdiction",
    "governingLaw",
    "userRole",
    "counterpartyRole",
    "industry",
    "transactionStructure",
    "transactionValue",
    "transactionCurrency",
    "transactionStage",
    "crossBorder",
    "regulatedIndustry",
    "entityTypes",
  ]
  for (const key of keys) {
    ;(envelope.fields[key] as ContextField<never>) = toContextField(key, parsed[key] ?? null)
  }
  // Full schema validation: rejects out-of-vocabulary values, bad types, and
  // any shape drift before this can be persisted or merged.
  return parseContextEnvelope(envelope)
}

// Merges a fresh inference into the stored envelope. User-confirmed fields are
// never overwritten by inference; everything else takes the new inferred value.
export function mergeInferredContext(
  existing: ContextEnvelope,
  inferred: ContextEnvelope
): ContextEnvelope {
  const merged = parseContextEnvelope(JSON.parse(JSON.stringify(existing)) as unknown)
  const keys = Object.keys(merged.fields) as ContextFieldKey[]
  for (const key of keys) {
    if (key === "dealType") continue
    if (merged.fields[key].source === "user_confirmed") continue
    ;(merged.fields[key] as ContextField<never>) = inferred.fields[key] as ContextField<never>
  }
  return merged
}
