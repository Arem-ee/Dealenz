import { describe, it, expect } from "vitest"
import { validateLawyerIntake } from "./lawyer-intake"

const VALID = {
  full_name: "Ada Lawyer",
  bio: "Commercial solicitor with ten years of practice.",
  bar_license_number: "NBA/12345",
  bar_jurisdiction: "Nigeria",
  specialties: ["contracts", "employment"],
  years_experience: 10,
  notable_cases: "Smith v Jones (2020)",
  certifications: ["Notary"],
}

describe("validateLawyerIntake", () => {
  it("accepts a well-formed application and trims values", () => {
    const res = validateLawyerIntake({ ...VALID, full_name: "  Ada Lawyer  " })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.full_name).toBe("Ada Lawyer")
      expect(res.value.years_experience).toBe(10)
    }
  })

  it("accepts minimal input (optional fields omitted)", () => {
    const res = validateLawyerIntake({
      full_name: "A",
      bio: "B",
      bar_license_number: "C",
      bar_jurisdiction: "D",
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.specialties).toEqual([])
      expect(res.value.years_experience).toBe(0)
      expect(res.value.notable_cases).toBeNull()
    }
  })

  it("rejects missing/empty required fields", () => {
    expect(validateLawyerIntake({}).ok).toBe(false)
    expect(validateLawyerIntake({ ...VALID, full_name: "  " }).ok).toBe(false)
    expect(validateLawyerIntake(null as never).ok).toBe(false)
  })

  it("enforces length bounds against oversized payloads", () => {
    expect(validateLawyerIntake({ ...VALID, full_name: "x".repeat(121) }).ok).toBe(false)
    expect(validateLawyerIntake({ ...VALID, bio: "x".repeat(5001) }).ok).toBe(false)
    expect(validateLawyerIntake({ ...VALID, specialties: ["x".repeat(81)] }).ok).toBe(false)
    expect(validateLawyerIntake({ ...VALID, specialties: Array(21).fill("contracts") }).ok).toBe(false)
  })

  it("enforces years_experience as an integer in range", () => {
    expect(validateLawyerIntake({ ...VALID, years_experience: -1 }).ok).toBe(false)
    expect(validateLawyerIntake({ ...VALID, years_experience: 81 }).ok).toBe(false)
    expect(validateLawyerIntake({ ...VALID, years_experience: 2.5 }).ok).toBe(false)
    expect(validateLawyerIntake({ ...VALID, years_experience: "10" }).ok).toBe(false)
    expect(validateLawyerIntake({ ...VALID, years_experience: NaN }).ok).toBe(false)
  })

  it("rejects non-array specialties and non-string items", () => {
    expect(validateLawyerIntake({ ...VALID, specialties: "contracts" }).ok).toBe(false)
    expect(validateLawyerIntake({ ...VALID, specialties: [123] }).ok).toBe(false)
    expect(validateLawyerIntake({ ...VALID, certifications: [null] }).ok).toBe(false)
  })
})
