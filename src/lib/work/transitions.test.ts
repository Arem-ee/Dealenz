import { describe, it, expect } from "vitest"
import { planTransition, stepTransition, executionTransition, isStepReady, isApprovalValidForPlan, canApprovePlan } from "./transitions"

describe("planTransition", () => {
  it("allows draft→awaiting_approval→approved→executing→done", () => {
    expect(planTransition.can("draft", "awaiting_approval")).toBe(true)
    expect(planTransition.can("awaiting_approval", "approved")).toBe(true)
    expect(planTransition.can("approved", "executing")).toBe(true)
    expect(planTransition.can("executing", "done")).toBe(true)
  })
  it("rejects invalid transitions", () => {
    expect(planTransition.can("draft", "done")).toBe(false)
    expect(planTransition.can("done", "draft")).toBe(false)
    expect(() => planTransition.assert("draft", "done")).toThrow()
  })
  it("allows failed→draft for retry", () => {
    expect(planTransition.can("failed", "draft")).toBe(true)
  })
})

describe("stepTransition", () => {
  it("pending→ready→running→succeeded", () => {
    expect(stepTransition.can("pending", "ready")).toBe(true)
    expect(stepTransition.can("ready", "running")).toBe(true)
    expect(stepTransition.can("running", "succeeded")).toBe(true)
  })
  it("running→needs_input→pending", () => {
    expect(stepTransition.can("running", "needs_input")).toBe(true)
    expect(stepTransition.can("needs_input", "pending")).toBe(true)
  })
  it("rejects succeeded→running", () => {
    expect(stepTransition.can("succeeded", "running")).toBe(false)
  })
})

describe("executionTransition", () => {
  it("pending→running→succeeded", () => {
    expect(executionTransition.can("pending", "running")).toBe(true)
    expect(executionTransition.can("running", "succeeded")).toBe(true)
  })
  it("running→needs_input→running→succeeded", () => {
    expect(executionTransition.can("running", "needs_input")).toBe(true)
    expect(executionTransition.can("needs_input", "running")).toBe(true)
  })
})

describe("isStepReady", () => {
  it("ready when deps succeeded", () => {
    expect(isStepReady({ dependsOn: ["a"], status: "pending" }, new Map([["a", "succeeded"]]))).toBe(true)
    expect(isStepReady({ dependsOn: ["a"], status: "pending" }, new Map([["a", "failed"]]))).toBe(false)
    expect(isStepReady({ dependsOn: [], status: "pending" }, new Map())).toBe(true)
  })
})

describe("approval validation", () => {
  it("canApprovePlan only from awaiting_approval", () => {
    expect(canApprovePlan("awaiting_approval")).toBe(true)
    expect(canApprovePlan("draft")).toBe(false)
  })
  it("isApprovalValidForPlan checks version and hash", () => {
    expect(isApprovalValidForPlan({ plan_version: 1, approved_payload_hash: "ph_abc" }, { version: 1, payload_hash: "ph_abc" })).toBe(true)
    expect(isApprovalValidForPlan({ plan_version: 1, approved_payload_hash: "ph_abc" }, { version: 2, payload_hash: "ph_abc" })).toBe(false)
    expect(isApprovalValidForPlan({ plan_version: 1, approved_payload_hash: "ph_abc" }, { version: 1, payload_hash: "ph_def" })).toBe(false)
  })
})
