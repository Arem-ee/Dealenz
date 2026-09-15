import { describe, it, expect } from "vitest"
import { CONSULTANT_ELICITATION_CAP, parseConsultantCloseOut, stripConsultantCloseOut, CONSULTANT_SYSTEM_PROMPT } from "./prompt"

describe("consultant prompt", () => {
  it("strips close out json from display text", () => {
    const raw = "Which country is this in?\n{\"decision\": \"create_deal\", \"dealType\": \"freelance\"}"
    expect(stripConsultantCloseOut(raw)).toBe("Which country is this in?")
    expect(parseConsultantCloseOut(raw)?.decision).toBe("create_deal")
  })

  it("returns null when last line is not a close out", () => {
    expect(parseConsultantCloseOut("Hello there")).toBeNull()
    expect(parseConsultantCloseOut("Question?\nNot json")).toBeNull()
  })

  it("parses answer_directly close out", () => {
    const raw = "An indemnity clause means ...\n{\"decision\": \"answer_directly\", \"reason\": \"one off\"}"
    expect(parseConsultantCloseOut(raw)?.decision).toBe("answer_directly")
    expect(stripConsultantCloseOut(raw)).toContain("indemnity")
  })

  it("has the required never list and stop conditions", () => {
    expect(CONSULTANT_SYSTEM_PROMPT).toContain("Never:")
    expect(CONSULTANT_SYSTEM_PROMPT).toContain("budget cap")
    expect(CONSULTANT_SYSTEM_PROMPT).toContain("Close out")
  })

  it("cap matches plan", () => {
    expect(CONSULTANT_ELICITATION_CAP).toBe(4)
  })
})
