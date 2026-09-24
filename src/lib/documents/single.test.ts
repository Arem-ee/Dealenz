import { describe, it, expect, vi } from "vitest"

const callAISurface = vi.fn()

vi.mock("@/lib/ai/client", () => ({
  callAISurface: (...args: unknown[]) => (callAISurface as (...a: unknown[]) => Promise<unknown>)(...args),
}))

import { generateSingleDocument, isPlanGeneratableFamily } from "./single"

const DATA = {
  goals: ["Build a website"],
  deliverables: ["Homepage", "Contact page"],
  timeline: "30 days",
  budget: "$5,000",
  projectType: "website",
  clientSignals: [],
  missingInformation: [],
  confidence: 0.9,
} as never

const cat = (severity = "low") => ({ severity, score: 20, findings: [] })
const REPORT = {
  overallScore: 70,
  riskLevel: "low",
  categories: {
    scopeRisk: cat(),
    paymentRisk: cat(),
    timelineRisk: cat(),
    communicationRisk: cat(),
    revisionRisk: cat(),
    legalRisk: cat(),
    ipRisk: cat(),
    clientRisk: cat(),
  },
  summary: "test",
  recommendations: [],
} as never

const PROFILE = {
  business_name: "Acme Studio",
  legal_entity: null,
  address: null,
  city: "Lagos",
  country: "Nigeria",
  email: null,
  phone: null,
  website: null,
  default_currency: null,
  default_payment_terms: null,
  standard_rate: null,
  rate_unit: null,
}

describe("isPlanGeneratableFamily", () => {
  it("accepts the four priced freelance families only", () => {
    expect(isPlanGeneratableFamily("proposal")).toBe(true)
    expect(isPlanGeneratableFamily("sow")).toBe(true)
    expect(isPlanGeneratableFamily("contract")).toBe(true)
    expect(isPlanGeneratableFamily("checklist")).toBe(true)
    expect(isPlanGeneratableFamily("protection_clause")).toBe(false)
    expect(isPlanGeneratableFamily("")).toBe(false)
  })
})

describe("generateSingleDocument", () => {
  it("returns AI content merged with the business profile", async () => {
    callAISurface.mockResolvedValueOnce({ text: "# Proposal\nCustom AI draft." })
    const out = await generateSingleDocument({ requestedType: "proposal", extractedData: DATA, riskReport: REPORT, businessProfile: PROFILE })
    expect(out.method).toBe("ai")
    expect(out.content).toContain("Custom AI draft.")
    expect(out.content).toContain("Acme Studio")
    expect(callAISurface).toHaveBeenCalledWith("authenticated", expect.objectContaining({ userContent: expect.stringContaining("Build a website") }))
  })

  it("falls back to templates and records the method honestly", async () => {
    callAISurface.mockRejectedValueOnce(new Error("provider down"))
    const out = await generateSingleDocument({ requestedType: "sow", extractedData: DATA, riskReport: REPORT, businessProfile: null })
    expect(out.method).toBe("template")
    expect(out.content).toContain("Scope of Work")
  })
})
