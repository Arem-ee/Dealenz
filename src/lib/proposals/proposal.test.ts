import { describe, it, expect, vi } from "vitest"
import { classifyOperation, inferIntent } from "@/lib/conversation/classify"
import { buildProposalPlan } from "./plan"
import { evaluateProposal } from "./evaluate"
import { emptyContextEnvelope } from "@/lib/context/schema"
import type { ExtractedData } from "@/lib/ai/extract"

const baseExtracted: ExtractedData = {
  goals: ["Improve conversion and clarify positioning"],
  deliverables: ["Website redesign", "Positioning rewrite"],
  timeline: "6 weeks",
  budget: "$15000",
  projectType: "web",
  clientSignals: ["needs conversion"],
  missingInformation: [],
  confidence: 0.9,
}

describe("proposal intent", () => {
  it("recognizes proposal intent", () => {
    expect(classifyOperation("I need a proposal for this website redesign", false)).toBe("proposal")
    expect(classifyOperation("I need something to send the client before we start", false)).toBe("proposal")
    expect(classifyOperation("Can you turn this into a proposal?", false)).toBe("proposal")
    expect(classifyOperation("I want to pitch this project", false)).toBe("proposal")
  })
  it("distinct from contract/SOW", () => {
    expect(classifyOperation("Help me respond to this proposal.", false)).toBe("drafting")
    expect(classifyOperation("Draft a contract for this", false)).toBe("drafting")
  })
  it("infers propose intent", () => {
    expect(inferIntent("I need a proposal", "proposal")).toBe("propose")
  })
})

describe("proposal planning", () => {
  it("objectives become proposal objectives", () => {
    const plan = buildProposalPlan({ envelope: emptyContextEnvelope(), extracted: baseExtracted })
    expect(plan.objectives[0].text).toContain("Improve conversion")
  })
  it("benefits grounded", () => {
    const plan = buildProposalPlan({ envelope: emptyContextEnvelope(), extracted: baseExtracted })
    expect(plan.benefits[0].groundedIn).toBeTruthy()
    expect(plan.benefits[0].isGuarantee).toBe(false)
  })
  it("complexity derived", () => {
    const simple = buildProposalPlan({ envelope: emptyContextEnvelope(), extracted: { ...baseExtracted, deliverables: ["One pager"], budget: "$500" } })
    expect(simple.complexity).toBe("simple")
    const ambitious = buildProposalPlan({ envelope: emptyContextEnvelope(), extracted: { ...baseExtracted, deliverables: ["A","B","C","D","E","F"], budget: "$100000", timeline: "6 months with milestones" } })
    expect(ambitious.complexity).toBe("ambitious")
  })
  it("unresolved stays unknown", () => {
    const plan = buildProposalPlan({ envelope: emptyContextEnvelope(), extracted: { ...baseExtracted, budget: null, timeline: null, missingInformation: ["price"] } })
    expect(plan.unresolved).toContain("commercial terms (price/payment)")
  })
})

describe("proposal rules", () => {
  it("objective without response fails", () => {
    const plan = buildProposalPlan({ envelope: emptyContextEnvelope(), extracted: baseExtracted })
    const eval1 = evaluateProposal(plan, "This proposal has no mention of the objective")
    expect(eval1.results.find((r) => r.ruleKey === "proposal-objective-coverage")?.status).toBe("FAIL")
  })
  it("deliverable without rationale fails", () => {
    const plan = buildProposalPlan({ envelope: emptyContextEnvelope(), extracted: baseExtracted })
    plan.deliverables[0].whyItMatters = null
    const eval1 = evaluateProposal(plan, "Deliverable: Website redesign. Features list.")
    expect(eval1.results.find((r) => r.ruleKey === "proposal-deliverable-rationale")?.status).toBe("FAIL")
  })
  it("unsupported guarantee flagged", () => {
    const plan = buildProposalPlan({ envelope: emptyContextEnvelope(), extracted: baseExtracted })
    const eval1 = evaluateProposal(plan, "We guarantee world-class transformative results")
    expect(eval1.results.find((r) => r.ruleKey === "proposal-no-guarantee")?.status).toBe("FAIL")
  })
  it("missing next step detected", () => {
    const plan = buildProposalPlan({ envelope: emptyContextEnvelope(), extracted: baseExtracted })
    plan.nextStep = null
    const eval1 = evaluateProposal(plan, "This concludes the document.")
    expect(eval1.results.find((r) => r.ruleKey === "proposal-next-step")?.status).toBe("FAIL")
  })
})

describe("proposal generation boundary", () => {
  it("uses existing AI boundary, no direct provider call", async () => {
    const src = await import("./generate")
    const content = await import("fs").then((fs) => fs.readFileSync("src/lib/proposals/generate.ts", "utf8"))
    expect(content).toContain("callAISurface")
    expect(content).not.toMatch(/fetch.*api\.openai|anthropic.*\/v1\/messages/)
  })
})

describe("proposal security", () => {
  it("untrusted source delimited, not system", async () => {
    const content = await import("fs").then((fs) => fs.readFileSync("src/lib/proposals/generate.ts", "utf8"))
    expect(content).toContain("untrusted-source-material")
  })
})
