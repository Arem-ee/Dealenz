import { describe, it, expect } from "vitest"
import { summarizePortfolio } from "./summary"

describe("summarizePortfolio", () => {
  it("returns honest zeros for a fresh account with an unanalyzed draft", () => {
    expect(
      summarizePortfolio([{ auditId: "a1", openIssues: null, overallScore: null, topCategories: [] }])
    ).toEqual({ totalOpen: 0, openDeals: 0, avgScore: null, ratedCount: 0, topCategories: [] })
  })

  it("aggregates across deals without double-counting one audit", () => {
    const summary = summarizePortfolio([
      { auditId: "a1", openIssues: 3, overallScore: 40, topCategories: [{ label: "Pay", count: 2 }] },
      { auditId: "a1", openIssues: 1, overallScore: 60, topCategories: [{ label: "Pay", count: 1 }] },
      { auditId: "a2", openIssues: 0, overallScore: null, topCategories: [] },
    ])
    expect(summary.totalOpen).toBe(4)
    expect(summary.openDeals).toBe(1)
    expect(summary.avgScore).toBe(50)
    expect(summary.ratedCount).toBe(2)
    expect(summary.topCategories).toEqual([{ label: "Pay", count: 3 }])
  })

  it("ignores non-positive and non-numeric open counts", () => {
    const summary = summarizePortfolio([
      { auditId: "a1", openIssues: 0 },
      { auditId: null, openIssues: 5 },
    ])
    expect(summary.totalOpen).toBe(5)
    // Null audit ids contribute issues but cannot name a deal.
    expect(summary.openDeals).toBe(0)
  })

  it("keeps the top three categories by count", () => {
    const summary = summarizePortfolio([
      {
        auditId: "a1",
        openIssues: 4,
        topCategories: [
          { label: "A", count: 1 },
          { label: "B", count: 3 },
          { label: "C", count: 2 },
          { label: "D", count: 4 },
        ],
      },
    ])
    expect(summary.topCategories.map((c) => c.label)).toEqual(["D", "B", "C"])
  })
})
