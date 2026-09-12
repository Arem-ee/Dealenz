// Lawyer application intake validation (Phase 1 security hardening).
//
// Shared by the API route and the Server Action so both enforce identical
// bounds. Rejects oversized/malformed payloads before any database write;
// never invents or normalizes applicant claims beyond trimming.

export interface LawyerIntakeInput {
  full_name?: unknown
  bio?: unknown
  bar_license_number?: unknown
  bar_jurisdiction?: unknown
  specialties?: unknown
  years_experience?: unknown
  notable_cases?: unknown
  certifications?: unknown
}

export interface ValidLawyerIntake {
  full_name: string
  bio: string
  bar_license_number: string
  bar_jurisdiction: string
  specialties: string[]
  years_experience: number
  notable_cases: string | null
  certifications: string[]
}

const MAX_SHORT = 120
const MAX_BIO = 5000
const MAX_LICENSE = 100
const MAX_SPECIALTIES = 20
const MAX_SPECIALTY_LEN = 80
const MAX_CERTIFICATIONS = 20
const MAX_CERT_LEN = 120
const MAX_EXPERIENCE_YEARS = 80

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > max) return null
  return trimmed
}

function cleanStringArray(value: unknown, maxItems: number, maxLen: number): string[] | null {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return null
  if (value.length > maxItems) return null
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string") return null
    const trimmed = item.trim()
    if (trimmed.length === 0 || trimmed.length > maxLen) return null
    out.push(trimmed)
  }
  return out
}

/** Returns validated intake, or an error message (never throws). */
export function validateLawyerIntake(
  input: LawyerIntakeInput
): { ok: true; value: ValidLawyerIntake } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid application" }

  const full_name = cleanString(input.full_name, MAX_SHORT)
  const bio = cleanString(input.bio, MAX_BIO)
  const bar_license_number = cleanString(input.bar_license_number, MAX_LICENSE)
  const bar_jurisdiction = cleanString(input.bar_jurisdiction, MAX_SHORT)
  if (!full_name || !bio || !bar_license_number || !bar_jurisdiction) {
    return { ok: false, error: "Missing or invalid required fields" }
  }

  const specialties = cleanStringArray(input.specialties, MAX_SPECIALTIES, MAX_SPECIALTY_LEN)
  const certifications = cleanStringArray(input.certifications, MAX_CERTIFICATIONS, MAX_CERT_LEN)
  if (!specialties || !certifications) {
    return { ok: false, error: "Invalid specialties or certifications" }
  }

  let years_experience = 0
  if (input.years_experience !== undefined && input.years_experience !== null) {
    if (typeof input.years_experience !== "number" || !Number.isInteger(input.years_experience)) {
      return { ok: false, error: "Invalid years of experience" }
    }
    if (input.years_experience < 0 || input.years_experience > MAX_EXPERIENCE_YEARS) {
      return { ok: false, error: "Invalid years of experience" }
    }
    years_experience = input.years_experience
  }

  let notable_cases: string | null = null
  if (input.notable_cases !== undefined && input.notable_cases !== null) {
    if (typeof input.notable_cases !== "string" || input.notable_cases.trim().length > MAX_BIO) {
      return { ok: false, error: "Invalid notable cases" }
    }
    notable_cases = input.notable_cases.trim() || null
  }

  return {
    ok: true,
    value: { full_name, bio, bar_license_number, bar_jurisdiction, specialties, years_experience, notable_cases, certifications },
  }
}
