import { describe, it, expect } from "vitest"
import { optionsForContextKey, optionLabel } from "./options"
import { parseContextEnvelope } from "./schema"

describe("optionsForContextKey", () => {
  it("serves the schema vocabularies for closed-vocabulary keys", () => {
    expect(optionsForContextKey("userRole")).toContain("freelancer")
    expect(optionsForContextKey("counterpartyRole")).toContain("client")
    expect(optionsForContextKey("industry")).toContain("technology")
    expect(optionsForContextKey("transactionStructure")).toContain("fixed_price")
    expect(optionsForContextKey("transactionStage")).toContain("negotiation")
    expect(optionsForContextKey("entityTypes")).toContain("company")
    expect(optionsForContextKey("dealType")).toContain("partnership")
    expect(optionsForContextKey("intent")).toContain("negotiate")
  })

  it("returns free text (null) for open keys", () => {
    for (const key of ["jurisdiction", "governingLaw", "transactionValue", "transactionCurrency", "priorities", "crossBorder", "regulatedIndustry", "unknown_key"]) {
      expect(optionsForContextKey(key)).toBeNull()
    }
  })

  it("only serves values the schema accepts", () => {
    // Every served option must validate as a user_confirmed value, so a tap
    // can never produce a correction the schema rejects.
    const KEYS = [
      "dealType", "intent", "priorities", "jurisdiction", "governingLaw",
      "userRole", "counterpartyRole", "industry", "transactionStructure",
      "transactionValue", "transactionCurrency", "transactionStage",
      "crossBorder", "regulatedIndustry", "entityTypes",
    ]
    const blankFields = Object.fromEntries(
      KEYS.map((k) => [k, { value: null, source: "unknown", confidence: 0 }])
    )
    for (const key of ["dealType", "intent", "userRole", "counterpartyRole", "industry", "transactionStructure", "transactionStage"]) {
      for (const option of optionsForContextKey(key) ?? []) {
        expect(() =>
          parseContextEnvelope({
            version: 1,
            fields: { ...blankFields, [key]: { value: option, source: "user_confirmed", confidence: 1 } },
            missingRequiredContext: [],
            updatedAt: null,
            updatedBy: null,
          })
        ).not.toThrow()
      }
    }
  })
})

describe("optionLabel", () => {
  it("humanizes snake_case values", () => {
    expect(optionLabel("fixed_price")).toBe("Fixed price")
    expect(optionLabel("freelancer")).toBe("Freelancer")
    expect(optionLabel("purchase_sale")).toBe("Purchase sale")
  })
})
