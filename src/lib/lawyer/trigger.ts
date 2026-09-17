import type { ContextEnvelope } from "@/lib/context/schema"
import type { ExtractedData } from "@/lib/ai/extract"

function parseAmount(text: string | null): number | null {
  if (!text) return null
  const cleaned = text.replace(/,/g, "").toLowerCase()
  const millionMatch = cleaned.match(/([\d.]+)\s*m(illion)?\b/)
  if (millionMatch) {
    const n = parseFloat(millionMatch[1])
    if (!Number.isNaN(n)) return n * 1_000_000
  }
  const kMatch = cleaned.match(/([\d.]+)\s*k\b/)
  if (kMatch) {
    const n = parseFloat(kMatch[1])
    if (!Number.isNaN(n)) return n * 1_000
  }
  const m = cleaned.match(/(?:\$|£|€|usd|gbp|eur|ngn)?\s*([\d.]+)/i)
  if (m) {
    const n = parseFloat(m[1])
    if (!Number.isNaN(n) && n > 0) {
      if (n < 1000 && cleaned.includes("m")) return n * 1_000_000
      return n
    }
  }
  return null
}

function hasMeaningfulValue(dealType: string, extracted: ExtractedData | null, facts: Record<string, { text: string | null } | null>, rawText: string): boolean {
  if (dealType === "purchase_sale") {
    const v = (facts as Record<string, { text: string | null }>).purchasePrice?.text ?? extracted?.budget ?? null
    const amt = parseAmount(v)
    return amt !== null ? amt >= 5000 : !!v && v.trim().length > 3
  }
  if (dealType === "lease") {
    const v = (facts as Record<string, { text: string | null }>).rent?.text ?? extracted?.budget ?? null
    const amt = parseAmount(v)
    return amt !== null ? amt >= 1000 : !!v
  }
  if (dealType === "employment") {
    const v = (facts as Record<string, { text: string | null }>).compensation?.text ?? extracted?.budget ?? null
    const amt = parseAmount(v)
    return amt !== null ? amt >= 5000 : !!v
  }
  if (dealType === "founder" || dealType === "partnership") {
    const v = (facts as Record<string, { text: string | null }>).dealValue?.text ?? (facts as Record<string, { text: string | null }>).valuation?.text ?? extracted?.budget ?? null
    const amt = parseAmount(v)
    if (amt !== null) return amt >= 10000
    return !!v && v.trim().length > 5
  }
  const v = extracted?.budget ?? null
  const amt = parseAmount(v)
  return amt !== null ? amt >= 10000 : false
}

function hasHardToUndoConsequence(dealType: string, facts: Record<string, { text: string | null } | null>, rawText: string): boolean {
  if (dealType !== "founder" && dealType !== "partnership") return false
  const lower = rawText.toLowerCase()
  const permanentSignals = /permanent|irrevocable|irreversible|hard to undo|difficult to unwind|perpetual|forever/i.test(lower)
  const ownership = (facts as Record<string, { text: string | null }>).ownershipSplit?.text ?? (facts as Record<string, { text: string | null }>).transferRestrictions?.text ?? null
  if (ownership && permanentSignals) return true
  if (permanentSignals && (facts as Record<string, { text: string | null }>).dilution?.text) return true
  return false
}

function hasExposurePattern(
  dealType: string,
  facts: Record<string, { text: string | null } | null>,
  rawText: string,
  envelope: ContextEnvelope | null,
  hasMeaningful: boolean
): boolean {
  const liability = (facts as Record<string, { text: string | null }>).liability?.text
  const liabilityCap = (facts as Record<string, { text: string | null }>).liabilityCap?.text
  const uncapped = !!liability && !liabilityCap

  const personalGuarantee = /personal guarantee|personally liable|personal liability/i.test(rawText)

  const dispute = (facts as Record<string, { text: string | null }>).disputeResolution?.text ?? (facts as Record<string, { text: string | null }>).termDissolution?.text ?? null
  const missingDisputeOnHighValue = !dispute && hasMeaningful

  const crossBorder = envelope?.fields.crossBorder.value === true
  const jurisdiction = envelope?.fields.jurisdiction.value
  const noJurisdiction = !jurisdiction || (jurisdiction as string).trim().length === 0
  const crossBorderNoJurisdiction = !!crossBorder && noJurisdiction

  return uncapped || personalGuarantee || missingDisputeOnHighValue || crossBorderNoJurisdiction
}

export interface LawyerTriggerInput {
  dealType: string
  extracted: ExtractedData | null
  facts: Record<string, { text: string | null } | null>
  rawText: string
  envelope: ContextEnvelope | null
  alreadySuggested?: boolean
}

export function shouldRecommendLawyerReview(input: LawyerTriggerInput): { should: boolean; reason: string } {
  if (input.alreadySuggested) return { should: false, reason: "already suggested" }

  const hasValue = hasMeaningfulValue(input.dealType, input.extracted, input.facts, input.rawText)
  const hardToUndo = hasHardToUndoConsequence(input.dealType, input.facts, input.rawText)
  const stakes = hasValue || hardToUndo

  if (!stakes) return { should: false, reason: "no meaningful stakes" }

  const exposure = hasExposurePattern(input.dealType, input.facts, input.rawText, input.envelope, hasValue)

  if (!exposure) return { should: false, reason: "no exposure pattern" }

  return { should: true, reason: `stakes (${hasValue ? "value" : "hard-to-undo"}) + exposure` }
}

// Fallback when value truly cannot be determined: allow exposure-only as exception
export function shouldRecommendLawyerReviewFallback(input: LawyerTriggerInput): boolean {
  if (input.alreadySuggested) return false
  const hasValue = hasMeaningfulValue(input.dealType, input.extracted, input.facts, input.rawText)
  if (hasValue) return false
  // No value at all, but exposure is strong (uncapped + personal guarantee)
  const rawLower = input.rawText.toLowerCase()
  const strongExposure = /personal guarantee/i.test(rawLower) && !input.facts.liabilityCap?.text
  return strongExposure
}
