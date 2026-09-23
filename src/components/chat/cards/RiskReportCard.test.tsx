import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { RiskReportCard } from "./RiskReportCard"

const PAYLOAD = {
  riskLevel: "High",
  overallScore: 32,
  findings: [
    {
      ruleKey: "unlimited-revisions",
      severity: "material",
      summary: "Unlimited revisions with no kill fee.",
      whyItMatters: "Scope can grow without pay.",
      pushback: "Cap revisions at two.",
      evidence: [],
    },
  ],
}

describe("RiskReportCard flat rows", () => {
  it("renders findings as quiet rows with no pill chrome", () => {
    const html = renderToStaticMarkup(<RiskReportCard payload={PAYLOAD} />)
    expect(html).toContain("How this deal looks")
    expect(html).toContain("Unlimited revisions with no kill fee.")
    expect(html).toContain("Should fix")
    expect(html).not.toContain("rounded-full")
    expect(html).not.toContain("uppercase tracking")
  })

  it("keeps the empty report honest", () => {
    const html = renderToStaticMarkup(<RiskReportCard payload={{ findings: [] }} />)
    expect(html).toContain("No major risks found")
  })
})
