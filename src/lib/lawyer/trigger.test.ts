import { describe, it, expect } from "vitest"
import { shouldRecommendLawyerReview, shouldRecommendLawyerReviewFallback, type LawyerTriggerInput } from "./trigger"
import { seedEnvelopeForDealType, applyUserConfirmation } from "@/lib/context"
import type { ExtractedData } from "@/lib/ai/extract"

function extracted(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    goals: [],
    deliverables: [],
    timeline: null,
    budget: null,
    projectType: null,
    clientSignals: [],
    missingInformation: [],
    confidence: 0.8,
    ...overrides,
  }
}

function base(dealType: string, overrides: Partial<LawyerTriggerInput> = {}): LawyerTriggerInput {
  return {
    dealType,
    extracted: extracted(),
    facts: {},
    rawText: "A simple freelance website build.",
    envelope: seedEnvelopeForDealType("freelance"),
    alreadySuggested: false,
    ...overrides,
  }
}

describe("lawyer-review trigger dual condition", () => {
  it("does not fire on a small routine freelance deal", () => {
    const res = shouldRecommendLawyerReview(base("freelance", {
      extracted: extracted({ budget: "$800" }),
      rawText: "Build a landing page for $800. Delivery in two weeks.",
    }))
    expect(res.should).toBe(false)
    expect(res.reason).toMatch(/no meaningful stakes/)
  })

  it("does not fire on most founder deals without an exposure pattern", () => {
    const res = shouldRecommendLawyerReview(base("founder", {
      extracted: extracted({ budget: "Founders agree a 60/40 split" }),
      facts: { ownershipSplit: { text: "60/40 split" } },
      rawText: "Two founders agree a 60/40 ownership split with four year vesting.",
      envelope: applyUserConfirmation(seedEnvelopeForDealType("founder"), {
        jurisdiction: { value: "Delaware", confidence: 1 },
      }),
    }))
    expect(res.should).toBe(false)
  })

  it("fires on meaningful value plus uncapped liability", () => {
    const res = shouldRecommendLawyerReview(base("purchase_sale", {
      extracted: extracted({ budget: "$50,000" }),
      facts: {
        purchasePrice: { text: "$50,000" },
        liability: { text: "Seller is liable for all losses" },
        liabilityCap: null,
      },
      rawText: "Sale of equipment for $50,000. Seller is liable for all losses without cap.",
    }))
    expect(res.should).toBe(true)
    expect(res.reason).toMatch(/stakes.*exposure/)
  })

  it("fires on hard-to-undo ownership change plus personal guarantee", () => {
    const res = shouldRecommendLawyerReview(base("founder", {
      facts: {
        ownershipSplit: { text: "permanent 70/30 split, irrevocable" },
        dilution: { text: "no anti-dilution" },
      },
      rawText: "Permanent irrevocable 70/30 ownership split. Founder gives a personal guarantee for the company loan.",
    }))
    expect(res.should).toBe(true)
  })

  it("fires once: already-suggested deals never re-trigger", () => {
    const res = shouldRecommendLawyerReview(base("purchase_sale", {
      extracted: extracted({ budget: "$50,000" }),
      facts: {
        purchasePrice: { text: "$50,000" },
        liability: { text: "liable" },
        liabilityCap: null,
      },
      rawText: "Sale for $50,000 with uncapped liability.",
      alreadySuggested: true,
    }))
    expect(res.should).toBe(false)
    expect(res.reason).toBe("already suggested")
  })

  it("fallback covers personal guarantee with no determinable value", () => {
    const ok = shouldRecommendLawyerReviewFallback(base("freelance", {
      facts: { liabilityCap: null },
      rawText: "Contractor signs a personal guarantee for project debts.",
    }))
    expect(ok).toBe(true)
  })

  it("fallback stays quiet on ordinary deals", () => {
    const ok = shouldRecommendLawyerReviewFallback(base("freelance", {
      extracted: extracted({ budget: "$800" }),
      rawText: "Build a landing page for $800.",
    }))
    expect(ok).toBe(false)
  })
})
