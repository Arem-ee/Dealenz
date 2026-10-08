import { describe, expect, it } from "vitest"
import { ANALYSIS_CREDITS } from "@/lib/credits/pricing"
import { MAX_BATCH_DEALS } from "@/lib/work/schema"
import { buildBatchManifest } from "./manifest"

describe("buildBatchManifest", () => {
  it("mixes types and prices N x analysis credits", () => {
    const out = buildBatchManifest([
      { auditId: "a", title: "A", dealType: "founder" },
      { auditId: "b", title: "B", dealType: "lease" },
      { auditId: "c", title: "C", dealType: "founder" },
    ])
    expect(out.count).toBe(3)
    expect(out.typeMix).toEqual([
      { dealType: "founder", count: 2 },
      { dealType: "lease", count: 1 },
    ])
    expect(out.estimateCredits).toBe(3 * ANALYSIS_CREDITS)
    expect(out.perFileCredits).toBe(ANALYSIS_CREDITS)
    expect(out.overLimit).toBe(false)
  })

  it("flags empty and oversized batches", () => {
    expect(buildBatchManifest([]).overLimit).toBe(true)
    const big = Array.from({ length: MAX_BATCH_DEALS + 1 }, (_, i) => ({
      auditId: `${i}`, title: `${i}`, dealType: "founder",
    }))
    expect(buildBatchManifest(big).overLimit).toBe(true)
  })

  it("buckets missing types as unknown", () => {
    const out = buildBatchManifest([{ auditId: "a", title: "A", dealType: null }])
    expect(out.typeMix).toEqual([{ dealType: "unknown", count: 1 }])
  })
})
