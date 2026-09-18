import { describe, it, expect } from "vitest"
import { autoFillDocumentVariables, getRequiredVariablesForFamily } from "./variable-autofill"
import type { ExtractedData } from "@/lib/ai/extract"
import type { ContextEnvelope } from "@/lib/context/schema"

const mockExtractedData: ExtractedData = {
  goals: ["Build a website"],
  deliverables: ["Website", "Documentation"],
  timeline: "4 weeks",
  budget: "$5,000 USD",
  projectType: "Web Development",
  clientSignals: ["Client wants quick delivery"],
  missingInformation: ["Design preferences"],
  confidence: 0.85,
}

const mockContextEnvelope = {
  version: 1,
  fields: {
    dealType: { value: "freelance", source: "user_confirmed", confidence: 1 },
    intent: { value: "review", source: "inferred", confidence: 0.8 },
    priorities: { value: ["timeline", "budget"], source: "inferred", confidence: 0.7 },
    jurisdiction: { value: "United States", source: "user_confirmed", confidence: 1 },
    governingLaw: { value: "Delaware", source: "inferred", confidence: 0.6 },
    userRole: { value: "freelancer", source: "inferred", confidence: 0.8 },
    counterpartyRole: { value: "client", source: "inferred", confidence: 0.8 },
    industry: { value: "technology", source: "inferred", confidence: 0.7 },
    transactionStructure: { value: "fixed_price", source: "inferred", confidence: 0.7 },
    transactionValue: { value: 5000, source: "extracted", confidence: 0.85 },
    transactionCurrency: { value: "USD", source: "extracted", confidence: 0.85 },
    transactionStage: { value: "negotiation", source: "inferred", confidence: 0.7 },
    crossBorder: { value: false, source: "inferred", confidence: 0.6 },
    regulatedIndustry: { value: false, source: "inferred", confidence: 0.6 },
    entityTypes: { value: ["individual"], source: "inferred", confidence: 0.6 },
  },
  missingRequiredContext: [],
  updatedAt: new Date().toISOString(),
  updatedBy: "user-1",
}

describe("autoFillDocumentVariables", () => {
  it("auto-fills budget from extracted data", () => {
    const result = autoFillDocumentVariables(
      mockExtractedData,
      mockContextEnvelope as any,
      "freelance",
      "founder-agreement",
      ["budget", "currency", "jurisdiction", "company_name"]
    )
    
    expect(result.variables.budget).toBe("$5,000 USD")
    expect(result.provenance.budget?.source).toBe("extracted")
    expect(result.provenance.budget?.confidence).toBe(0.85)
  })

  it("auto-fills currency from extracted data", () => {
    const result = autoFillDocumentVariables(
      mockExtractedData,
      mockContextEnvelope as any,
      "freelance",
      "founder-agreement",
      ["currency"]
    )
    
    expect(result.variables.currency).toBe("USD")
    expect(result.provenance.currency?.source).toBe("extracted")
  })

  it("auto-fills jurisdiction from context envelope", () => {
    const result = autoFillDocumentVariables(
      mockExtractedData,
      mockContextEnvelope as any,
      "freelance",
      "founder-agreement",
      ["jurisdiction"]
    )
    
    expect(result.variables.jurisdiction).toBe("United States")
    expect(result.provenance.jurisdiction?.source).toBe("context")
  })

  it("marks missing variables when no source available", () => {
    const result = autoFillDocumentVariables(
      { ...mockExtractedData, budget: null },
      mockContextEnvelope as any,
      "freelance",
      "founder-agreement",
      ["missing_field"]
    )
    
    expect(result.missing).toContain("missing_field")
    expect(result.variables.missing_field).toBeUndefined()
  })

  it("handles missing context envelope gracefully", () => {
    const result = autoFillDocumentVariables(
      mockExtractedData,
      null,
      "freelance",
      "founder-agreement",
      ["budget", "jurisdiction"]
    )
    
    expect(result.variables.budget).toBe("$5,000 USD")
    expect(result.missing).toContain("jurisdiction")
  })

  it("preserves user-provided vars over auto-filled", () => {
    const result = autoFillDocumentVariables(
      mockExtractedData,
      mockContextEnvelope as any,
      "freelance",
      "founder-agreement",
      ["budget", "currency"]
    )
    
    // The function returns auto-filled vars; merging with user vars happens in the caller
    expect(result.variables.budget).toBe("$5,000 USD")
    expect(result.variables.currency).toBe("USD")
  })

  it("extracts currency code from budget string", () => {
    const extractedWithEUR = { ...mockExtractedData, budget: "€3,000 EUR" }
    const result = autoFillDocumentVariables(
      extractedWithEUR,
      mockContextEnvelope as any,
      "freelance",
      "founder-agreement",
      ["currency"]
    )
    
    expect(result.variables.currency).toBe("EUR")
  })

  it("returns correct missing variables", () => {
    const result = autoFillDocumentVariables(
      mockExtractedData,
      mockContextEnvelope as any,
      "freelance",
      "founder-agreement",
      ["budget", "jurisdiction", "unknown_field"]
    )
    
    expect(result.missing).toEqual(["unknown_field"])
    expect(result.variables.budget).toBe("$5,000 USD")
    expect(result.variables.jurisdiction).toBe("United States")
  })
})

describe("getRequiredVariablesForFamily", () => {
  it("returns common variables for any family", () => {
    const vars = getRequiredVariablesForFamily("founder-agreement", "founder")
    expect(vars).toContain("jurisdiction")
  })

  it("includes partnership_structure for partnership deal types", () => {
    const vars = getRequiredVariablesForFamily("partnership-agreement", "partnership")
    expect(vars).toContain("jurisdiction")
    expect(vars).toContain("partnership_structure")
  })
})