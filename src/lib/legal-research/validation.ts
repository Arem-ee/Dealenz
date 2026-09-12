// Source validation + temporal handling (Phase 27).
//
// Every legal source must have verifiable provenance. Missing authority,
// jurisdiction mismatch, stale effective dates, or allowlist failure degrade
// the source to STALE/UNVERIFIED rather than being presented as VERIFIED.

import { isAllowedUrl, authorityTierForUrl, MAX_CITATION_PASSAGE_CHARS } from "./allowlist"
import type { LegalSource, VeracityState } from "./types"

export interface ValidationOutcome {
  state: VeracityState
  reason: string | null // human note when not VERIFIED
}

export function validateLegalSource(source: LegalSource, now: Date = new Date()): ValidationOutcome {
  if (!source.originalUri || !isAllowedUrl(source.originalUri)) {
    return { state: "UNVERIFIED", reason: "Source URL is not on the allowlisted authoritative registry." }
  }
  const tierFromUrl = authorityTierForUrl(source.originalUri)
  if (tierFromUrl === 3) {
    return { state: "UNVERIFIED", reason: "Secondary commentary cannot be presented as primary law." }
  }
  if (source.authorityTier !== tierFromUrl) {
    // Allow Tier 2 explicit, but warn if claimed Tier 1 on Tier 2 host.
    if (source.authorityTier === 1 && tierFromUrl === 2) {
      return { state: "UNVERIFIED", reason: "Tier 1 authority claimed on a Tier 2 host." }
    }
  }
  if (!source.retrievedAt || Number.isNaN(Date.parse(source.retrievedAt))) {
    return { state: "UNVERIFIED", reason: "Missing or invalid retrieval timestamp." }
  }
  if (!source.effectiveFrom || Number.isNaN(Date.parse(source.effectiveFrom))) {
    return { state: "UNVERIFIED", reason: "Missing effective date." }
  }
  const supportedCountries = new Set(["Nigeria", "Federal Republic of Nigeria", "United States", "United Kingdom", "European Union", "Germany", "France", "Netherlands", "Testland"])
  if (!supportedCountries.has(source.jurisdiction.country)) {
    return { state: "UNVERIFIED", reason: `Jurisdiction ${source.jurisdiction.country} is not in the current supported set (US/UK/EU/Germany/France/Netherlands/Nigeria).` }
  }
  if (!source.sourceName || !source.sourceReference || !source.sourceAuthority) {
    return { state: "UNVERIFIED", reason: "Incomplete provenance." }
  }
  if (!source.excerpt || source.excerpt.trim().length < 20) {
    return { state: "UNVERIFIED", reason: "Supporting passage too short to verify." }
  }

  // Temporal check: repealed/superseded or effective date far future/past.
  if (source.temporalStatus === "repealed" || source.temporalStatus === "superseded") {
    return { state: "STALE", reason: `Source is ${source.temporalStatus} and may no longer be current.` }
  }
  const effective = new Date(source.effectiveFrom)
  if (effective.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
    return { state: "STALE", reason: "Effective date is in the future." }
  }
  if (source.effectiveTo) {
    const until = new Date(source.effectiveTo)
    if (!Number.isNaN(until.getTime()) && until.getTime() < now.getTime()) {
      return { state: "STALE", reason: "Source effective period has ended." }
    }
  }
  // If retrieved more than 365 days ago and no fresh check, mark stale.
  const retrieved = new Date(source.retrievedAt)
  const ageDays = (now.getTime() - retrieved.getTime()) / (86400000)
  if (ageDays > 365) {
    return { state: "STALE", reason: "Source was retrieved more than a year ago and may be stale." }
  }

  // Citation passage must be within the content (grounded, not hallucinated).
  if (source.content && source.excerpt) {
    const passage = source.excerpt.trim().slice(0, MAX_CITATION_PASSAGE_CHARS)
    if (!source.content.includes(passage.slice(0, Math.min(40, passage.length)))) {
      return { state: "UNVERIFIED", reason: "Citation passage does not appear in retrieved content." }
    }
  }

  if (source.temporalStatus === "unknown") {
    return { state: "SUPPORTED", reason: "Temporal status is unknown; treat as supported, not verified, and confirm currency." }
  }
  if (source.temporalStatus === "amended") {
    return { state: "SUPPORTED", reason: "Source has been amended; cited passage should be confirmed against the amended text." }
  }
  return { state: "VERIFIED", reason: null }
}

export function aggregateVeracity(states: VeracityState[]): VeracityState {
  if (states.length === 0) return "NOT_FOUND"
  if (states.includes("NEEDS_JURISDICTION")) return "NEEDS_JURISDICTION"
  if (states.includes("CONFLICTING")) return "CONFLICTING"
  if (states.every((s) => s === "VERIFIED")) return "VERIFIED"
  if (states.includes("STALE")) return "STALE"
  if (states.includes("UNVERIFIED")) return "UNVERIFIED"
  if (states.includes("SUPPORTED")) return "SUPPORTED"
  return states[0]
}
