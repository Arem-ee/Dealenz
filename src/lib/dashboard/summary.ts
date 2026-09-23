import type { PortfolioSummary } from "@/app/dashboard/page"

export interface PortfolioThread {
  auditId: string | null
  openIssues?: number | null
  overallScore?: number | null
  topCategories?: Array<{ label: string; count: number }>
}

// Portfolio aggregates derive purely from thread rows: no database access,
// so they cannot fail and must never gate the dashboard. A failed activity
// query hides the week strip, never the tiles or the table.
export function summarizePortfolio(threads: PortfolioThread[]): PortfolioSummary {
  let totalOpen = 0
  const openDeals = new Set<string>()
  let scoreSum = 0
  let ratedCount = 0
  const catCounts = new Map<string, number>()
  for (const t of threads ?? []) {
    if (typeof t.openIssues === "number" && t.openIssues > 0) {
      totalOpen += t.openIssues
      if (t.auditId) openDeals.add(t.auditId)
    }
    if (typeof t.overallScore === "number") {
      scoreSum += t.overallScore
      ratedCount += 1
    }
    for (const c of t.topCategories ?? []) {
      catCounts.set(c.label, (catCounts.get(c.label) ?? 0) + c.count)
    }
  }
  const topCategories = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => ({ label, count }))
  return {
    totalOpen,
    openDeals: openDeals.size,
    avgScore: ratedCount > 0 ? Math.round(scoreSum / ratedCount) : null,
    ratedCount,
    topCategories,
  }
}
