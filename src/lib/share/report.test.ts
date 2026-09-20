import { describe, it, expect } from "vitest"
import { toSharedReport } from "./report"

describe("toSharedReport", () => {
  it("publishes FAIL findings only, with counter-words and evidence quotes", () => {
    const report = toSharedReport({
      dealType: "freelance",
      riskLevel: "High",
      overallScore: 20,
      deterministicFindings: [
        {
          status: "FAIL",
          finding: {
            severity: "material",
            summary: "The deal promises unlimited revisions.",
            guidance: "Cap revisions.",
            pushback: "Please cap revisions at two rounds.",
            evidence: [{ quote: "unlimited revisions until approval" }, { quote: 42 }],
          },
        },
        { status: "PASS" },
        { status: "UNKNOWN", finding: { summary: "x" } },
        { status: "FAIL", finding: { severity: "attention", summary: "" } },
        null,
      ],
    })
    expect(report.dealType).toBe("freelance")
    expect(report.riskLevel).toBe("High")
    expect(report.overallScore).toBe(20)
    expect(report.findingCount).toBe(1)
    expect(report.findings[0]).toEqual({
      severity: "material",
      summary: "The deal promises unlimited revisions.",
      guidance: "Cap revisions.",
      pushback: "Please cap revisions at two rounds.",
      evidence: [{ quote: "unlimited revisions until approval" }],
    })
  })

  it("stays honest on missing input instead of inventing a report", () => {
    const report = toSharedReport({})
    expect(report.dealType).toBe("unknown")
    expect(report.riskLevel).toBe("Unknown")
    expect(report.overallScore).toBeNull()
    expect(report.findings).toEqual([])
    expect(report.findingCount).toBe(0)
  })
})
