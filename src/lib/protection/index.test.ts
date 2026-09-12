import { describe, it, expect } from "vitest"
import { canGenerateDocuments, documentGenerationUnavailableMessage, SUPPORTED_DOCUMENT_DEAL_TYPES } from "./index"

describe("protection document generation boundary", () => {
  it("allows generation only for freelance", () => {
    expect(canGenerateDocuments("freelance")).toBe(true)
  })

  it("denies generation for every other supported vertical", () => {
    expect(canGenerateDocuments("lease")).toBe(false)
    expect(canGenerateDocuments("purchase_sale")).toBe(false)
    expect(canGenerateDocuments("employment")).toBe(false)
    expect(canGenerateDocuments("founder")).toBe(false)
    expect(canGenerateDocuments("partnership")).toBe(false)
    expect(canGenerateDocuments("generic")).toBe(false)
  })

  it("denies unknown or empty inputs — never routes strangers into freelance generation", () => {
    expect(canGenerateDocuments("unknown")).toBe(false)
    expect(canGenerateDocuments("")).toBe(false)
    expect(canGenerateDocuments("partnership ")).toBe(false)
    expect(canGenerateDocuments("FREELANCE")).toBe(false)
  })

  it("exposes the supported set as a single source", () => {
    expect(SUPPORTED_DOCUMENT_DEAL_TYPES).toEqual(["freelance"])
  })

  it("returns empty message for freelance and honest coming-soon for others", () => {
    expect(documentGenerationUnavailableMessage("freelance")).toBe("")
    for (const dt of ["lease", "purchase_sale", "employment", "founder", "partnership", "generic"] as const) {
      const msg = documentGenerationUnavailableMessage(dt)
      expect(msg.length).toBeGreaterThan(0)
      expect(msg).toMatch(/coming soon/i)
    }
  })
})
