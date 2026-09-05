import { describe, it, expect } from "vitest"
import { registeredVerticalKeys, verticalForDealType } from "./index"

describe("vertical dispatcher", () => {
  it("resolves freelance and lease packs and nothing else", () => {
    expect(registeredVerticalKeys().sort()).toEqual(["freelance", "lease"])
    const freelance = verticalForDealType("freelance")
    expect(freelance?.key).toBe("freelance")
    expect(typeof freelance?.deriveFacts).toBe("function")
    expect(typeof freelance?.registerPack).toBe("function")
    expect(typeof freelance?.selectCandidates).toBe("function")
    const lease = verticalForDealType("lease")
    expect(lease?.key).toBe("lease")
    expect(typeof lease?.deriveFacts).toBe("function")
    expect(typeof lease?.registerPack).toBe("function")
    expect(typeof lease?.selectCandidates).toBe("function")
  })

  it("returns null for generic and unknown deal types", () => {
    expect(verticalForDealType("generic")).toBeNull()
    expect(verticalForDealType("unknown")).toBeNull()
    expect(verticalForDealType("")).toBeNull()
  })
})
