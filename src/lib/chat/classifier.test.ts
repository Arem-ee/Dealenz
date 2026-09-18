import { describe, it, expect } from "vitest"
import { classifyInput } from "./classifier"

// The unified classifier is the single source of truth for every entry
// point (composer, file drop). No component may re-implement routing.
describe("classifyInput", () => {
  it("routes greetings to a free inline answer with no deal", () => {
    expect(classifyInput("hello", false)).toEqual({ outcome: "greeting", operation: "conversation" })
    expect(classifyInput("Hi", false).outcome).toBe("greeting")
  })

  it("routes questions to Ask, never to deal creation", () => {
    const r = classifyInput("What does indemnity mean?", false)
    expect(r.outcome).toBe("question")
  })

  it("routes deal content to a thread", () => {
    const r = classifyInput("Freelance website build for $2,500 with 50% upfront and delivery in 4 weeks. ".repeat(6), false)
    expect(r.outcome).toBe("deal")
  })

  it("routes an attached file to a thread", () => {
    expect(classifyInput("Document: contract.pdf", true).outcome).toBe("deal")
  })

  it("routes explicit lawyer requests to the in-chat action", () => {
    expect(classifyInput("get a lawyer on this", false).outcome).toBe("action")
    expect(classifyInput("Can you get a lawyer on this deal?", false).outcome).toBe("action")
  })

  it("routes explicit generation requests to the in-chat action", () => {
    expect(classifyInput("generate a proposal for this client", false).outcome).toBe("action")
  })
})
