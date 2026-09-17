import { describe, it, expect } from "vitest"
import { isLinkFlow, LINK_CALLBACK_PATH, resolveNextPath } from "./link"

describe("resolveNextPath", () => {
  it("accepts known internal destinations", () => {
    expect(resolveNextPath("/dashboard")).toBe("/dashboard")
    expect(resolveNextPath("/settings")).toBe("/settings")
    expect(resolveNextPath("/chat")).toBe("/chat")
    expect(resolveNextPath("/vault")).toBe("/vault")
    expect(resolveNextPath("/lawyer-application")).toBe("/lawyer-application")
    expect(resolveNextPath("/lawyer-application/status")).toBe("/lawyer-application/status")
  })

  it("rejects external origins", () => {
    expect(resolveNextPath("https://evil.example")).toBe("/dashboard")
    expect(resolveNextPath("http://evil.example/x")).toBe("/dashboard")
  })

  it("rejects protocol-relative URLs", () => {
    expect(resolveNextPath("//evil.example")).toBe("/dashboard")
  })

  it("rejects javascript: and data: schemes", () => {
    expect(resolveNextPath("javascript:alert(1)")).toBe("/dashboard")
    expect(resolveNextPath("data:text/html,hi")).toBe("/dashboard")
  })

  it("rejects encoded external destinations", () => {
    expect(resolveNextPath("%2F%2Fevil.example")).toBe("/dashboard")
    expect(resolveNextPath("/%2e%2e/evil")).toBe("/dashboard")
  })

  it("rejects unknown internal paths and non-strings", () => {
    expect(resolveNextPath("/admin/secret")).toBe("/dashboard")
    expect(resolveNextPath(null)).toBe("/dashboard")
    expect(resolveNextPath(undefined)).toBe("/dashboard")
  })
})

describe("isLinkFlow", () => {
  it("detects the explicit link flow only", () => {
    const params = new URLSearchParams("flow=link")
    expect(isLinkFlow(params)).toBe(true)
    expect(isLinkFlow(new URLSearchParams(""))).toBe(false)
    expect(isLinkFlow(new URLSearchParams("flow=login"))).toBe(false)
  })
})

describe("LINK_CALLBACK_PATH", () => {
  it("is a fixed server-owned relative path", () => {
    expect(LINK_CALLBACK_PATH.startsWith("/")).toBe(true)
    expect(LINK_CALLBACK_PATH).toContain("flow=link")
  })
})
