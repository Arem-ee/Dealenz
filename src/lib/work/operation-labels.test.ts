import { describe, it, expect } from "vitest"
import { friendlyObjective, friendlyOperation } from "./operation-labels"

describe("work operation labels", () => {
  it("names known operations in plain language", () => {
    expect(friendlyOperation("document_analysis")).toBe("Analyze the deal")
    expect(friendlyOperation("send_email")).toBe("Send the emails")
  })

  it("prettifies unknown operations instead of leaking ids", () => {
    expect(friendlyOperation("custom_step")).toBe("Custom step")
    expect(friendlyObjective("deal_analysis")).toBe("Deal analysis")
    expect(friendlyObjective("batch_outreach")).toBe("Batch outreach")
  })
})
