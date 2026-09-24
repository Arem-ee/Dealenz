import { describe, it, expect } from "vitest"
import { classifyDealTypeFromText, normalizeDealType } from "./deal-type"

describe("normalizeDealType", () => {
  it("keeps the freelance default for existing callers", () => {
    expect(normalizeDealType("lease")).toBe("lease")
    expect(normalizeDealType("bogus")).toBe("freelance")
    expect(normalizeDealType(undefined)).toBe("freelance")
  })
  it("accepts an explicit fallback", () => {
    expect(normalizeDealType("bogus", "generic")).toBe("generic")
    expect(normalizeDealType(undefined, "generic")).toBe("generic")
    expect(normalizeDealType("founder", "generic")).toBe("founder")
  })
})

describe("classifyDealTypeFromText", () => {
  it("sorts strong vertical signals", () => {
    expect(classifyDealTypeFromText("This lease agreement sets the monthly rent. The tenant pays a security deposit for the premises.")).toBe("lease")
    expect(classifyDealTypeFromText("The employer offers a salary with payroll and benefits. This employment agreement lists job duties.")).toBe("employment")
    expect(classifyDealTypeFromText("Founder vesting with a one-year cliff. The cap table shows the equity split between co-founders.")).toBe("founder")
    expect(classifyDealTypeFromText("Partnership agreement: the managing partner runs operations. Profit sharing follows the partnership interest.")).toBe("partnership")
    expect(classifyDealTypeFromText("Purchase agreement for the goods. The purchase price is payable on delivery. Title transfers on payment.")).toBe("purchase_sale")
    expect(classifyDealTypeFromText("Freelancer deliverables and scope of work. The statement of work allows two revision rounds.")).toBe("freelance")
  })
  it("falls back to generic on weak, tied, or missing signals", () => {
    expect(classifyDealTypeFromText("")).toBe("generic")
    expect(classifyDealTypeFromText("   ")).toBe("generic")
    // Single shared hit is not enough to claim a vertical.
    expect(classifyDealTypeFromText("The monthly rent is due.")).toBe("generic")
    // Cross-vertical tie stays generic rather than guessing.
    expect(classifyDealTypeFromText("The landlord and the employer agree the salary covers the monthly rent.")).toBe("generic")
    // Bare commercial terms with no vertical vocabulary.
    expect(classifyDealTypeFromText("The parties agree to payment within thirty days of invoice.")).toBe("generic")
  })
})
