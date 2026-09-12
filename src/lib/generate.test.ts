import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/ai/client", () => ({
  callAISurface: vi.fn(() => Promise.reject(new Error("provider down"))),
}))

import { generateDocuments } from "./generate"

const DATA = {
  goals: [],
  deliverables: [],
  timeline: null,
  budget: null,
  projectType: null,
  clientSignals: [],
  missingInformation: [],
  confidence: 0.9,
} as never

const cat = (severity = "low") => ({ severity, score: 20, findings: [] })
const REPORT = {
  overallScore: 40,
  riskLevel: "low",
  categories: {
    scopeRisk: cat(),
    paymentRisk: cat(),
    timelineRisk: cat(),
    communicationRisk: cat(),
    revisionRisk: cat(),
    legalRisk: cat(),
    ipRisk: cat(),
    clientRisk: cat(),
  },
  summary: "test",
  recommendations: [],
} as never

describe("generateDocuments fallback hook", () => {
  it("falls back to templates and reports each degraded document", async () => {
    const seen: Array<{ document: string }> = []
    const docs = await generateDocuments(DATA, REPORT, "authenticated", (info) => {
      seen.push({ document: info.document })
    })
    expect(docs.proposal.method).toBe("template")
    expect(docs.sow.method).toBe("template")
    expect(docs.contract.method).toBe("template")
    expect(docs.checklist.method).toBe("template")
    expect(seen.map((s) => s.document).sort()).toEqual(["checklist", "contract", "proposal", "sow"])
  })

  it("works without a hook (backward compatible)", async () => {
    const docs = await generateDocuments(DATA, REPORT)
    expect(docs.proposal.method).toBe("template")
  })

  it("a throwing hook never breaks generation", async () => {
    const docs = await generateDocuments(DATA, REPORT, "authenticated", () => {
      throw new Error("observer down")
    })
    expect(docs.proposal.method).toBe("template")
  })
})
