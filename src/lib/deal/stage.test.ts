import { describe, it, expect } from "vitest"
import { dealStage } from "./stage"

describe("dealStage", () => {
  it("maps backend statuses to stages without inventing states", () => {
    expect(dealStage({ status: "completed", hasContent: true, hasRisk: true, docsGenerated: true, hasVersions: true }).stage).toBe("completed")
    expect(dealStage({ status: "failed", hasContent: true, hasRisk: false, docsGenerated: false, hasVersions: false }).stage).toBe("failed")
    expect(dealStage({ status: "processing", hasContent: true, hasRisk: false, docsGenerated: false, hasVersions: false }).stage).toBe("analyzing")
  })

  it("asks for input before analysis exists", () => {
    const s = dealStage({ status: "draft", hasContent: false, hasRisk: false, docsGenerated: false, hasVersions: false })
    expect(s.stage).toBe("intake")
    expect(s.primary?.target).toBe("#deal-intake")
  })

  it("prioritizes signing and review states over documents", () => {
    const signing = dealStage({ status: "analyzed", hasContent: true, hasRisk: true, docsGenerated: true, hasVersions: true, signersPending: 2 })
    expect(signing.stage).toBe("signing_next")
    expect(signing.headline).toContain("2 signatures")
    const review = dealStage({ status: "analyzed", hasContent: true, hasRisk: true, docsGenerated: true, hasVersions: false, reviewActive: true })
    expect(review.stage).toBe("lawyer_next")
  })

  it("falls back to protection, then documents, from real outputs only", () => {
    const protect = dealStage({ status: "analyzed", hasContent: true, hasRisk: true, docsGenerated: false, hasVersions: false })
    expect(protect.stage).toBe("ready_protect")
    expect(protect.primary?.target).toBe("#deal-protection")
    const docs = dealStage({ status: "analyzed", hasContent: true, hasRisk: true, docsGenerated: true, hasVersions: false })
    expect(docs.stage).toBe("ready_documents")
    expect(docs.primary?.target).toBe("#deal-documents")
  })

  it("every primary target is a real in-page anchor", () => {
    const targets = ["#deal-intake", "#deal-protection", "#deal-documents", "#deal-review"]
    const cases = [
      dealStage({ status: "draft", hasContent: false, hasRisk: false, docsGenerated: false, hasVersions: false }),
      dealStage({ status: "analyzed", hasContent: true, hasRisk: true, docsGenerated: false, hasVersions: false }),
      dealStage({ status: "analyzed", hasContent: true, hasRisk: true, docsGenerated: true, hasVersions: true }),
      dealStage({ status: "analyzed", hasContent: true, hasRisk: true, docsGenerated: true, hasVersions: true, reviewActive: true }),
    ]
    for (const c of cases) {
      expect(c.primary).not.toBeNull()
      expect(targets).toContain(c.primary?.target)
    }
  })
})
