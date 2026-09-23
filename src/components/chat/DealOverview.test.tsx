import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { DealOverview } from "./DealOverview"

const INPUT = {
  title: "CTO offer",
  budget: null,
  dealType: "partnership",
  userRole: null,
  counterpartyRole: null,
  jurisdiction: null,
  openIssues: 2,
  resolvedCount: 0,
  executed: false,
  signingActive: false,
  hasMonitoring: false,
  topIssues: [],
  signedLabel: null,
  onAskPushback: () => {},
  onAskRecheck: () => {},
}

describe("DealOverview actions dock", () => {
  it("renders docked actions in the collapsed bar without nesting buttons", () => {
    const html = renderToStaticMarkup(
      <DealOverview input={INPUT} collapsed onToggleCollapsed={() => {}} actions={<span>Revise input</span>} />
    )
    expect(html).toContain("Revise input")
    expect(html).toContain("CTO offer")
  })

  it("renders docked actions in the expanded header", () => {
    const html = renderToStaticMarkup(
      <DealOverview input={INPUT} actions={<span>Revise input</span>} />
    )
    expect(html).toContain("Revise input")
    expect(html).toContain("CTO offer")
  })
})
