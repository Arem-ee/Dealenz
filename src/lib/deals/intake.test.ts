import { describe, expect, it } from "vitest"
import {
  deriveTitle,
  fitMessage,
  isIntakeDealType,
  MAX_INTAKE_FILES,
  proposeDealType,
  sanitizeStorageName,
  validateStagedFile,
} from "./intake"

describe("deriveTitle", () => {
  it("collapses whitespace and caps length with an ellipsis", () => {
    expect(deriveTitle("  Shop   lease\nfor Main St  ")).toBe("Shop lease for Main St")
    const long = `x${"y".repeat(200)}`
    const title = deriveTitle(long)
    expect(title.length).toBeLessThanOrEqual(80)
    expect(title.endsWith("…")).toBe(true)
  })

  it("never returns an empty title", () => {
    expect(deriveTitle("   \n  ")).toBe("Untitled deal")
  })
})

describe("proposeDealType", () => {
  it("proposes transparently per vertical and defaults generic", () => {
    expect(proposeDealType("four year vesting with a cliff")).toBe("founder")
    expect(proposeDealType("profit share partnership")).toBe("partnership")
    expect(proposeDealType("the landlord raised the rent")).toBe("lease")
    expect(proposeDealType("salary and severance terms")).toBe("employment")
    expect(proposeDealType("asset sale, buyer and seller")).toBe("purchase_sale")
    expect(proposeDealType("freelance scope of work and invoice")).toBe("freelance")
    expect(proposeDealType("hello there")).toBe("generic")
    expect(proposeDealType("")).toBe("generic")
  })

  it("only admits canonical deal types", () => {
    expect(isIntakeDealType("founder")).toBe(true)
    expect(isIntakeDealType("nonsense")).toBe(false)
    expect(isIntakeDealType(null)).toBe(false)
  })
})

describe("validateStagedFile", () => {
  const pdf = { name: "deal.pdf", size: 1024, type: "application/pdf" }

  it("accepts supported files", () => {
    expect(validateStagedFile(pdf, 0)).toBeNull()
    expect(validateStagedFile({ name: "notes.txt", size: 10, type: "" }, 0)).toBeNull()
  })

  it("rejects empty, oversized, unsupported, and over-count files", () => {
    expect(validateStagedFile({ ...pdf, size: 0 }, 0)?.kind).toBe("empty")
    expect(validateStagedFile({ ...pdf, size: 11 * 1024 * 1024 }, 0)?.kind).toBe("size")
    expect(validateStagedFile({ name: "photo.png", size: 100, type: "image/png" }, 0)?.kind).toBe("type")
    expect(validateStagedFile(pdf, MAX_INTAKE_FILES)?.kind).toBe("count")
  })
})

describe("fitMessage", () => {
  it("passes short text through and marks truncation", () => {
    expect(fitMessage("hi").truncated).toBe(false)
    const big = fitMessage("z".repeat(9000))
    expect(big.truncated).toBe(true)
    expect(big.content.length).toBeLessThanOrEqual(8000)
    expect(big.content).toContain("(truncated)")
  })
})

describe("sanitizeStorageName", () => {
  it("strips paths and unsafe characters", () => {
    expect(sanitizeStorageName("../../etc/passwd")).toBe("passwd")
    expect(sanitizeStorageName("My Deal (final)!.pdf")).toBe("My_Deal_final_.pdf")
  })
})
