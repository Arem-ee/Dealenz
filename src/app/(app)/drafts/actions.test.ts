import { describe, expect, it } from "vitest"
import { kindOfFamily } from "./actions"

describe("kindOfFamily", () => {
  it("sorts families into Agreements, Terms, and Schedules", () => {
    expect(kindOfFamily("founder-agreement")).toBe("Agreements")
    expect(kindOfFamily("contract")).toBe("Agreements")
    expect(kindOfFamily("purchase-terms-sheet")).toBe("Terms")
    expect(kindOfFamily("proposal")).toBe("Terms")
    expect(kindOfFamily("contribution-schedule")).toBe("Schedules")
    expect(kindOfFamily("vesting-schedule")).toBe("Schedules")
    expect(kindOfFamily("something-new")).toBe("Terms")
  })
})
