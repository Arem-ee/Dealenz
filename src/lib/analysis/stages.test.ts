import { describe, it, expect } from "vitest"
import { deriveAnalysisStages, hasStageSignal } from "./stages"

const row = (phase: string, status: string) => ({ phase, status })

describe("deriveAnalysisStages", () => {
  it("starts all pending with no rows", () => {
    const stages = deriveAnalysisStages([])
    expect(stages.map((s) => s.state)).toEqual(["pending", "pending", "pending", "pending", "pending"])
    expect(hasStageSignal(stages)).toBe(false)
  })

  it("advances one active stage at a time through a clean run", () => {
    // Extraction starting means knowledge settled (the pipeline awaits it
    // before the extraction phase opens), so reading already reads done.
    let stages = deriveAnalysisStages([row("knowledge", "start"), row("extraction", "start")])
    expect(stages.map((s) => `${s.key}:${s.state}`)).toEqual([
      "reading:done",
      "extracting:active",
      "risk:pending",
      "rules:pending",
      "responses:pending",
    ])
    stages = deriveAnalysisStages([row("knowledge", "success"), row("extraction", "success"), row("risk", "start")])
    expect(stages.map((s) => `${s.key}:${s.state}`)).toEqual([
      "reading:done",
      "extracting:done",
      "risk:active",
      "rules:pending",
      "responses:pending",
    ])
  })

  it("marks completed-but-unlogged tail stages done once the pipeline moves on", () => {
    // Rules degraded (failure, continued) then negotiation started: rules
    // reads done, never red, for an analysis that completes.
    const stages = deriveAnalysisStages([
      row("extraction", "success"),
      row("risk", "success"),
      row("rules", "failure"),
      row("negotiation_points", "start"),
    ])
    expect(stages.find((s) => s.key === "rules")?.state).toBe("done")
    expect(stages.find((s) => s.key === "responses")?.state).toBe("active")
  })

  it("ignores per-file failures that do not abort the run", () => {
    // A bad file logs file_processing failure and is skipped; knowledge
    // succeeded, so reading reads done — never red — for a run that continues.
    const stages = deriveAnalysisStages([row("knowledge", "success"), row("file_processing", "failure"), row("extraction", "start")])
    expect(stages.find((s) => s.key === "reading")?.state).toBe("done")
    expect(stages.find((s) => s.key === "extracting")?.state).toBe("active")
  })

  it("paints fatal-phase failure red and freezes the tail", () => {
    const stages = deriveAnalysisStages([row("knowledge", "success"), row("extraction", "failure")])
    expect(stages.map((s) => `${s.key}:${s.state}`)).toEqual([
      "reading:done",
      "extracting:failed",
      "risk:pending",
      "rules:pending",
      "responses:pending",
    ])
    expect(hasStageSignal(stages)).toBe(true)
  })

  it("omits the responses stage for freelance analyses", () => {
    const stages = deriveAnalysisStages([row("extraction", "success"), row("risk", "success"), row("rules", "success")], {
      expectsResponses: false,
    })
    expect(stages.map((s) => s.key)).toEqual(["reading", "extracting", "risk", "rules"])
    expect(stages.every((s) => s.state === "done")).toBe(true)
  })
})
